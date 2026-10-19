<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('uhe_plants', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->uuid('company_uuid');
            $t->string('code', 30); $t->string('name', 160); $t->string('state', 2);
            $t->timestamps(); $t->unique(['company_uuid', 'code']);
            $t->foreign('company_uuid')->references('uuid')->on('companies')->restrictOnDelete();
        });
        Schema::create('uhe_reservoirs', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->uuid('company_uuid'); $t->uuid('plant_id');
            $t->string('name', 160); $t->timestamps();
            $t->foreign('plant_id')->references('id')->on('uhe_plants')->restrictOnDelete();
            $t->unique(['plant_id', 'name']); $t->index('company_uuid');
        });
        Schema::create('uhe_requests', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->uuid('company_uuid'); $t->uuid('reservoir_id');
            $t->string('protocol', 80); $t->text('description'); $t->string('category', 80);
            $t->string('priority', 16); $t->string('status', 32)->default('open');
            $t->decimal('latitude', 10, 7); $t->decimal('longitude', 10, 7);
            $t->decimal('access_latitude', 10, 7)->nullable(); $t->decimal('access_longitude', 10, 7)->nullable();
            $t->unsignedInteger('service_seconds'); $t->timestamp('due_at')->nullable();
            $t->timestamps(); $t->unique(['company_uuid', 'protocol']);
            $t->index(['company_uuid', 'status', 'due_at']);
            $t->foreign('reservoir_id')->references('id')->on('uhe_reservoirs')->restrictOnDelete();
        });
        Schema::create('uhe_request_orders', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->uuid('company_uuid'); $t->uuid('request_id');
            $t->uuid('order_uuid'); $t->string('idempotency_key', 80); $t->string('input_hash', 64);
            $t->timestamps(); $t->unique(['company_uuid', 'idempotency_key']);
            $t->foreign('request_id')->references('id')->on('uhe_requests')->restrictOnDelete();
            $t->foreign('order_uuid')->references('uuid')->on('orders')->restrictOnDelete();
        });
        Schema::create('uhe_audit_events', function (Blueprint $t) {
            $t->uuid('id')->primary(); $t->uuid('company_uuid'); $t->uuid('actor_uuid');
            $t->string('action', 80); $t->uuid('subject_id'); $t->json('details'); $t->timestamp('created_at');
            $t->index(['company_uuid', 'created_at']);
        });
    }
    public function down(): void
    {
        foreach (['uhe_audit_events','uhe_request_orders','uhe_requests','uhe_reservoirs','uhe_plants'] as $table) Schema::dropIfExists($table);
    }
};
