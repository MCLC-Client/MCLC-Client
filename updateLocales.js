const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'src', 'locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const translations = {
    'en_us.json': { title: "Minimize to Tray", desc: "Hide the launcher to the system tray when closing or minimizing." },
    'en_uk.json': { title: "Minimise to Tray", desc: "Hide the launcher to the system tray when closing or minimising." },
    'de_de.json': { title: "In den System-Tray minimieren", desc: "Versteckt den Launcher im System-Tray beim Schließen oder Minimieren." },
    'de_ch.json': { title: "In den System-Tray minimieren", desc: "Versteckt den Launcher im System-Tray beim Schließen oder Minimieren." },
    'es_es.json': { title: "Minimizar a la bandeja del sistema", desc: "Ocultar el lanzador en la bandeja del sistema al cerrar o minimizar." },
    'fr_fr.json': { title: "Réduire dans la zone de notification", desc: "Masquer le lanceur dans la zone de notification lors de la fermeture ou de la réduction." },
    'it_it.json': { title: "Riduci a icona", desc: "Nasconde il launcher nel vassoio di sistema alla chiusura o riduzione." },
    'pl_pl.json': { title: "Minimalizuj do zasobnika", desc: "Ukryj program w zasobniku systemowym po zamknięciu lub minimalizacji." },
    'pt_br.json': { title: "Minimizar para a bandeja", desc: "Ocultar o inicializador na bandeja do sistema ao fechar ou minimizar." },
    'pt_pt.json': { title: "Minimizar para a bandeja", desc: "Ocultar o inicializador na bandeja do sistema ao fechar ou minimizar." },
    'ro_ro.json': { title: "Minimizare în bara de sistem", desc: "Ascunde lansatorul în bara de sistem la închidere sau minimizare." },
    'ru_ru.json': { title: "Сворачивать в трей", desc: "Скрывать лаунчер в системный трей при закрытии или сворачивании." },
    'sk_sk.json': { title: "Minimalizovať do lišty", desc: "Skryť spúšťač do systémovej lišty pri zatvorení alebo minimalizácii." },
    'sl_si.json': { title: "Pomanjšaj v orodno vrstico", desc: "Skrij zaganjalnik v sistemsko vrstico pri zapiranju ali pomanjšanju." },
    'sv_se.json': { title: "Minimera till systemfältet", desc: "Dölj startprogrammet i systemfältet när du stänger eller minimerar det." }
};

for (const file of files) {
    const filePath = path.join(localesDir, file);
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(content);

        if (!json.settings) json.settings = {};
        if (!json.settings.integration) json.settings.integration = {};

        const tr = translations[file] || translations['en_us.json'];
        json.settings.integration.minimize_to_tray = tr.title;
        json.settings.integration.minimize_to_tray_desc = tr.desc;

        fs.writeFileSync(filePath, JSON.stringify(json, null, 4));
        console.log(`Updated ${file}`);
    } catch (e) {
        console.error(`Error processing ${file}: ${e.message}`);
    }
}
