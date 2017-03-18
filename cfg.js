/**
 * Modul zur Gernerierung von Konfigurationsvariablen
 * Die Parameter werden aus der Datei config/server/IP_des_Servers/serverIPS.json bezogen
 *
 * @Author: Klaas Wuellner
 */


'use strict';

const fs = require('fs'); // Zugriff auf das Dateisystem
const nodeJsSIPsocket = require('jssip-node-websocket'); //JsSIP Node Websocket Modul
const HOSTNAME = require('os').hostname();

// TODO: ungenutzte variable löschen?
let AKTUELLER_SERVER = ''; //globale Variable für aktuellen Server. Einbindung in Konfig zur Darstellung des aktuellen Server via Jade Template layout.jade

/**
 * suche in allen Netzwerkadressen nach einer existierende Datei in ./config/servers/ geht vor,
 * damit man auf einer Maschine mehrfach mit unterschiedlichen Ports starten kann
 * @returns {JSON}
 */
function getIPs() {
	try {
		return require('./config/servers/serverIPs.json');
	}
	catch (e) {
		// try next
	}
	const networkInterfaces = require('os').networkInterfaces();
	for (const netInterface in networkInterfaces) {
		for (const adapter in networkInterfaces[netInterface]) {
			try {
				AKTUELLER_SERVER = networkInterfaces[netInterface][adapter].address; //TODO:Port auslesen bzw. einbinden
				return require('./config/servers/' + networkInterfaces[netInterface][adapter].address + '/serverIPs.json');
			}
			catch (e) {
				// try next
			}
		}
	}
}
const cfgIPs = getIPs();
console.log(cfgIPs);

const jsSIPsocketDUE =  new nodeJsSIPsocket('ws://' + cfgIPs.sipIP + ':10080');
const jsSIPsocketMockRFD =  new nodeJsSIPsocket('ws://' + cfgIPs.sipIP + ':10080');

/**
 * Globale Serverkonfiguration
 * @type {{
 * urlRFDWebservice: string,
 * jsSipConfiguration_DUE: {
 *      ws_servers: string,
 *      uri: string,
 *      password: string
 *      },
 * jsSipConfiguration_mockRFD: {
 *      ws_servers: string,
 *      uri: string,
 *      password: string
 *      },
 * mongodb: array,
 * replicaSet: string,
 * auth,
 * auth_user: string,
 * auth_pw: *,
 * port: string,
 * configPath: string,
 * intervall: number,
 * alternativeIPs: array,
 * cfgIPs: JSON,
 * aktuellerServer: string,
 * aktuellerHostname: string,
 * loglevelConsole: string,
 * loglevelFile: string
 * }}
 */
const cfg = {
	'urlRFDWebservice': 'http://' + cfgIPs.rfdIP + ':8789/I_RFD_DUE_Steuerung',

	'jsSipConfiguration_DUE': {
		'sockets': [jsSIPsocketDUE],
		'uri': 'sip:due@' + cfgIPs.sipIP + ':5060',
		// TODO fuer unterschiedliche Passwoerter dev/stage/prod: noch in serverIPs auslagern
		'password': 'due'
	},
	'jsSipConfiguration_mockRFD': {
		'sockets': [jsSIPsocketMockRFD],
		'uri': 'sip:rfd@' + cfgIPs.sipIP + ':5060',
		// TODO fuer unterschiedliche Passwoerter dev/stage/prod: noch in serverIPs auslagern, unterschiedliche Passwoerter vergeben, mindestens produktiv
		'password': 'rfd'
	},

	'mongodb': cfgIPs.mongoDbs,
	'replicaSet': cfgIPs.replicaSet || 'dueReplicaSet',
	'auth': cfgIPs.auth,
	'auth_user': cfgIPs.auth_user || 'ukwserver',
	'auth_pw': cfgIPs.auth_pw,

	//HTTP Port für die nodeJS Instanz
	'port': cfgIPs.port || '3000',
	'configPath': 'config/',

	// 0 = Überprüfung abschalten
	'intervall': cfgIPs.checkRfdIntervallInSeconds * 1000 || 0,
	'alternativeIPs': cfgIPs.alternativeServer,
	'aktuellerServer': AKTUELLER_SERVER,
	'aktuellerHostname': HOSTNAME,
	cfgIPs,

	loglevelConsole: cfgIPs.loglevelConsole || 'debug',
	loglevelFile: cfgIPs.loglevelFile || 'info',

	displaySperreTimeout: 10, // Dauer der Displaysperre in Sekunden
};

module.exports = cfg;
