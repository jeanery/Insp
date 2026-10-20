export default {
    setupExtension(app, universe) {
        universe.getService('menu').registerHeaderMenuItem('SIG-UHE', 'console.sig-uhe', {
            icon: 'water', priority: 1, description: 'Inspeções de usinas e reservatórios',
        });
    },
};
