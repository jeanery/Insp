import Engine from '@ember/engine';
import Resolver from 'ember-resolver';
import loadInitializers from 'ember-load-initializers';
import { services, externalRoutes } from '@fleetbase/ember-core/exports';
export default class SigUheEngine extends Engine {
    modulePrefix = '@sig-uhe/engine';
    Resolver = Resolver;
    dependencies = { services, externalRoutes };
}
loadInitializers(SigUheEngine, '@sig-uhe/engine');
