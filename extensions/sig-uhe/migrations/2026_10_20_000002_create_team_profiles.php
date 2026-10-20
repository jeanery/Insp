<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void
    {
        Schema::create('uhe_team_profiles', function (Blueprint $t) {
            $t->uuid('fleet_uuid')->primary(); $t->uuid('company_uuid');
            $t->string('availability',16); $t->string('timezone',64);
            $t->decimal('base_latitude',10,7); $t->decimal('base_longitude',10,7);
            $t->json('skills'); $t->json('weekly_windows');
            $t->unsignedInteger('daily_capacity_minutes'); $t->unsignedInteger('version'); $t->timestamps();
            $t->foreign('fleet_uuid')->references('uuid')->on('fleets')->restrictOnDelete();
            $t->foreign('company_uuid')->references('uuid')->on('companies')->restrictOnDelete();
            $t->index('company_uuid');
        });
    }
    public function down(): void { Schema::dropIfExists('uhe_team_profiles'); }
};
