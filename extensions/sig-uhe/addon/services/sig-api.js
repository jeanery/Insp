import Service from '@ember/service';
import { inject as service } from '@ember/service';

export default class SigApiService extends Service {
    @service fetch;
    options = { namespace: 'sig-uhe/v1', rawError: true };

    get(path, query = {}) {
        return this.fetch.get(path, query, { ...this.options, host: window.location.origin });
    }
    post(path, data) {
        return this.fetch.post(path, data, { ...this.options, host: window.location.origin });
    }
    patch(path, data) {
        return this.fetch.patch(path, data, { ...this.options, host: window.location.origin });
    }
    async catalog(path) {
        let page = 1;
        const rows = [];
        while (page <= 20) {
            const result = await this.get(path, { page });
            rows.push(...result.data);
            if (page >= result.last_page) return rows;
            page++;
        }
        throw new Error('O cadastro ultrapassa 1.000 registros. Refine o catálogo antes de continuar.');
    }
    importCsv(text) {
        return this.fetch.request('requests/import', 'POST', { body: text }, {
            ...this.options, host: window.location.origin, headers: { 'Content-Type': 'text/csv' },
        });
    }
}
