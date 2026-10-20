import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

const STATUS = {
    open: 'Aberta', triage: 'Em triagem', awaiting_schedule: 'Aguardando programação',
    scheduled: 'Programada', in_progress: 'Em execução', completed: 'Concluída', cancelled: 'Cancelada',
};
const NEXT = {
    open: ['triage', 'cancelled'], triage: ['awaiting_schedule', 'cancelled'],
    awaiting_schedule: ['scheduled', 'cancelled'], scheduled: ['in_progress', 'awaiting_schedule', 'cancelled'],
    in_progress: ['completed', 'cancelled'], completed: [], cancelled: [],
};
const PRIORITY = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };

export default class SigWorkspaceComponent extends Component {
    @service sigApi;
    @tracked section = 'overview';
    @tracked busy = true;
    @tracked saving = false;
    @tracked error = '';
    @tracked notice = '';
    @tracked summary = null;
    @tracked plants = [];
    @tracked reservoirs = [];
    @tracked teams = [];
    @tracked requests = [];
    @tracked audit = [];
    @tracked auditPage = 1;
    @tracked auditLastPage = 1;
    @tracked page = 1;
    @tracked lastPage = 1;
    @tracked total = 0;
    @tracked query = '';
    @tracked status = '';
    @tracked form = null;
    @tracked formData = {};
    @tracked selected = null;
    @tracked orders = [];
    // Retain this key on errors so retries cannot create duplicate orders.
    issuanceKey = null;
    generation = 0;

    constructor() {
        super(...arguments);
        this.refresh();
    }
    get tabs() {
        return [
            ['overview', 'Visão geral', 'chart-line'], ['requests', 'Solicitações', 'clipboard-list'],
            ['plants', 'UHEs e reservatórios', 'water'], ['teams', 'Equipes', 'users'], ['audit', 'Histórico', 'clock-rotate-left'],
        ].map(([id, label, icon]) => ({ id, label, icon, active: this.section === id }));
    }
    get isOverview() { return this.section === 'overview'; }
    get isRequests() { return this.section === 'requests'; }
    get isPlants() { return this.section === 'plants'; }
    get isTeams() { return this.section === 'teams'; }
    get isAudit() { return this.section === 'audit'; }
    get hasPrevious() { return this.page > 1; }
    get hasNext() { return this.page < this.lastPage; }
    get hasAuditPrevious() { return this.auditPage > 1; }
    get hasAuditNext() { return this.auditPage < this.auditLastPage; }
    get isPlantForm() { return this.form === 'plant'; }
    get isReservoirForm() { return this.form === 'reservoir'; }
    get isRequestForm() { return this.form === 'request'; }
    get isTeamForm() { return this.form === 'team'; }
    get isOrderForm() { return this.form === 'order'; }
    get isStatusForm() { return this.form === 'status'; }
    get formTitle() {
        return { plant: 'Cadastrar UHE', reservoir: 'Cadastrar reservatório', request: 'Nova solicitação',
            team: 'Cadastrar equipe', order: 'Emitir ordem de serviço', status: 'Atualizar situação' }[this.form];
    }
    get statusOptions() { return Object.entries(STATUS).map(([value, label]) => ({ value, label })); }
    get nextStatuses() { return (NEXT[this.selected?.status] || []).map(value => ({ value, label: STATUS[value] })); }
    get states() { return 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '); }
    get requestRows() {
        const names = new Map(this.reservoirs.map(item => [item.id, item.name]));
        return this.requests.map(item => ({ ...item, reservoirName: names.get(item.reservoir_id) || item.reservoir_id,
            statusLabel: STATUS[item.status], priorityLabel: PRIORITY[item.priority],
            hasAccess: item.access_latitude !== null && item.access_longitude !== null,
            canIssue: !['completed', 'cancelled'].includes(item.status),
            canTransition: (NEXT[item.status] || []).length > 0,
        }));
    }
    get reservoirRows() {
        const names = new Map(this.plants.map(item => [item.id, item.name]));
        return this.reservoirs.map(item => ({ ...item, plantName: names.get(item.plant_id) || item.plant_id }));
    }
    get auditRows() {
        const names = { 'create.uhe_plants': 'UHE cadastrada', 'create.uhe_reservoirs': 'Reservatório cadastrado',
            'create.uhe_requests': 'Solicitação cadastrada', 'create.uhe_request_orders': 'Vínculo de OS criado',
            'order.issued': 'Ordem de serviço emitida', 'team.created': 'Equipe cadastrada', 'request.status_changed': 'Situação alterada' };
        return this.audit.map(item => ({ ...item, label: names[item.action] || item.action }));
    }
    get selectedStatus() { return STATUS[this.selected?.status]; }
    get selectedHasAccess() { return this.selected?.access_latitude != null && this.selected?.access_longitude != null; }
    get selectedCanIssue() { return this.selected && !['completed', 'cancelled'].includes(this.selected.status); }
    get selectedCanTransition() { return (NEXT[this.selected?.status] || []).length > 0; }
    get canWrite() { return this.summary?.can_write === true; }
    get selectedDetailVisible() { return this.selected && !this.form; }
    message(error) {
        if (error?.errors && typeof error.errors === 'object') return Object.values(error.errors).flat().join(' ');
        return error?.message || error?.error || 'Não foi possível concluir a operação. Verifique sua conexão e permissão e tente novamente.';
    }
    @action async refresh(options = {}) {
        const generation = ++this.generation;
        this.busy = true;
        this.error = '';
        try {
            const catalogs = !this.summary || options.catalogs !== false;
            const [summary, plants, reservoirs, teams] = await Promise.all([
                this.sigApi.get('overview'),
                catalogs ? this.sigApi.catalog('plants') : this.plants,
                catalogs ? this.sigApi.catalog('reservoirs') : this.reservoirs,
                catalogs ? this.sigApi.catalog('teams') : this.teams,
            ]);
            if (this.isDestroying || this.isDestroyed || generation !== this.generation) return;
            this.summary = summary; this.plants = plants; this.reservoirs = reservoirs; this.teams = teams;
            await this.loadSection();
        } catch (error) {
            if (!this.isDestroyed) this.error = this.message(error);
        } finally { if (!this.isDestroyed) this.busy = false; }
    }
    async loadSection() {
        if (this.isRequests || this.isOverview) {
            const result = await this.sigApi.get('requests', { page: this.page, q: this.query, status: this.status });
            this.requests = result.data; this.lastPage = result.last_page; this.total = result.total;
        }
        if (this.isAudit) {
            const result = await this.sigApi.get('audit', { page: this.auditPage });
            this.audit = result.data; this.auditLastPage = result.last_page;
        }
    }
    @action async navigate(section) {
        if (this.busy || this.saving) return;
        this.section = section; this.selected = null; this.form = null; this.notice = ''; this.error = '';
        this.busy = true;
        try { await this.loadSection(); } catch (error) { this.error = this.message(error); }
        finally { this.busy = false; }
    }
    @action updateField(field, event) { this.formData = { ...this.formData, [field]: event.target.value }; }
    @action updateQuery(event) { this.query = event.target.value; }
    @action updateStatus(event) { this.status = event.target.value; }
    @action async search(event) {
        event?.preventDefault(); this.page = 1; this.busy = true; this.error = '';
        try { await this.loadSection(); } catch (error) { this.error = this.message(error); }
        finally { this.busy = false; }
    }
    @action async changePage(delta) {
        this.page += delta; this.busy = true;
        try { await this.loadSection(); } catch (error) { this.page -= delta; this.error = this.message(error); }
        finally { this.busy = false; }
    }
    @action async changeAuditPage(delta) {
        this.auditPage += delta; this.busy = true;
        try { await this.loadSection(); } catch (error) { this.auditPage -= delta; this.error = this.message(error); }
        finally { this.busy = false; }
    }
    @action openForm(form) {
        this.form = form; this.error = ''; this.notice = '';
        this.formData = { state: 'PR', priority: 'normal', service_seconds: 900 };
        if (form === 'order') this.issuanceKey = crypto.randomUUID();
        if (form === 'status') this.formData = { status: this.nextStatuses[0]?.value || '', reason: '' };
    }
    @action close() {
        if (this.saving) return;
        this.form = null; this.selected = null; this.orders = []; this.error = ''; this.issuanceKey = null;
    }
    @action async selectRequest(item) {
        this.selected = item; this.form = null; this.error = ''; this.orders = [];
        try {
            const orders = await this.sigApi.get(`requests/${item.id}/orders`);
            if (this.selected?.id === item.id) this.orders = orders;
        }
        catch (error) { this.error = this.message(error); }
    }
    @action async save(event) {
        event?.preventDefault();
        if (this.saving || !this.canWrite) return;
        this.saving = true; this.error = '';
        const type = this.form;
        try {
            const data = { ...this.formData };
            if (type === 'request') {
                for (const field of ['latitude', 'longitude', 'access_latitude', 'access_longitude', 'service_seconds']) {
                    if (data[field] === '' || data[field] == null) delete data[field];
                    else data[field] = Number(data[field]);
                }
            }
            if (type === 'status') await this.sigApi.patch(`requests/${this.selected.id}`, data);
            else if (type === 'order') await this.sigApi.post(`requests/${this.selected.id}/orders`, { ...data, idempotency_key: this.issuanceKey });
            else await this.sigApi.post({ plant: 'plants', reservoir: 'reservoirs', request: 'requests', team: 'teams' }[type], data);
            this.form = null; this.selected = null; this.notice = type === 'order' ? 'Ordem emitida. A equipe poderá ser programada pelo planejamento operacional.' : 'Registro salvo com sucesso.';
            this.page = 1;
            await this.refresh({ catalogs: ['plant', 'reservoir', 'team'].includes(type) });
        } catch (error) { this.error = this.message(error); }
        finally { this.saving = false; }
    }
    @action async importCsv(event) {
        const file = event.target.files[0];
        if (!file || this.saving || !this.canWrite) return;
        this.saving = true; this.error = '';
        try {
            if (file.size > 2 * 1024 * 1024) throw new Error('O arquivo deve ter até 2 MiB.');
            const result = await this.sigApi.importCsv(await file.text());
            this.notice = `${result.count} solicitações importadas com sucesso.`;
            this.page = 1; await this.refresh({ catalogs: false });
        } catch (error) { this.error = this.message(error); }
        finally { this.saving = false; event.target.value = ''; }
    }
}
