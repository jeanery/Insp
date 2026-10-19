<?php
namespace SigUhe;

use Closure;
use Illuminate\Http\Request;

final class Access
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        abort_unless($user && session('company') && $user->company_uuid === session('company'), 403);
        abort_unless(\Fleetbase\Models\CompanyUser::where('company_uuid',session('company'))->where('user_uuid',$user->uuid)->where('status','active')->exists(),403);
        $permission = $request->isMethod('GET') ? 'sig-uhe.read' : 'sig-uhe.write';
        // Missing permission records deny access; they never imply a grant.
        $allowed = $user->isAdmin();
        if (!$allowed) {
            try { $allowed = $user->hasPermissionTo($permission, 'sanctum'); }
            catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) { $allowed = false; }
        }
        abort_unless($allowed, 403);
        return $next($request);
    }
}
