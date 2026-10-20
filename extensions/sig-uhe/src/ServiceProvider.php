<?php
namespace SigUhe;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider as BaseProvider;

final class ServiceProvider extends BaseProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../migrations');
        Route::prefix('sig-uhe/v1')->middleware(['fleetbase.protected', Access::class, 'throttle:60,1'])->group(function () {
            Route::get('overview', [Controller::class, 'overview']);
            Route::get('teams', [Controller::class, 'teams']);
            Route::post('teams', [Controller::class, 'createTeam']);
            Route::patch('requests/{id}', [Controller::class, 'updateRequest']);
            Route::get('plants', [Controller::class, 'plants']);
            Route::post('plants', [Controller::class, 'createPlant']);
            Route::get('reservoirs', [Controller::class, 'reservoirs']);
            Route::post('reservoirs', [Controller::class, 'createReservoir']);
            Route::get('requests', [Controller::class, 'requests']);
            Route::post('requests', [Controller::class, 'createRequest']);
            Route::post('requests/import', [Controller::class, 'import']);
            Route::post('requests/orders/batch', [Controller::class, 'issueBatch']);
            Route::post('requests/{id}/orders', [Controller::class, 'issueOrder']);
            Route::get('requests/{id}/orders', [Controller::class, 'orders']);
            Route::get('audit', [Controller::class, 'audit']);
        });
    }
}
