'use strict';

/**
 * Modul zur Verwaltung der Socket-Verbindungen zwischen Server und Client
 * Erstellt für die Wasserstraßen und Schifffahrtsverwaltung
 * TODO: Code enstprechend anpassen, da die aus dem Beispiel des RFD stammt
 * @Author: Klaas Wüllner (WSV), xxx (IBM)
 *
 */

const db      = require('./datenbank.js'); // Module zur Verbindung zur Datenbank
const cfg     = require('./cfg.js');
const log     = require('./log.js');
const vif     = require('./vifWs.js');
const tools   = require('./tools.js');
const util    = require('util');
const request = require('request'); //Modul zu Abfrage von WebServices

const FILENAME = __filename.slice(__dirname.length + 1);

const io           = require('socket.io');
const socketClient = require('socket.io-client');

let socketServer; //Variable um die Sockets ausserhalb der Funktion "on.connect" aufzurufen

log.debug(FILENAME + ' geladen.');

let dueStatusServerA = null;
let dueStatusServerB = null;

exports.socket = function (server) {
	log.debug(FILENAME + ' Socket Server established');

	socketServer = io.listen(server);
	socketServer.on('connect', function (socket) {

		const remoteAddress = (tools.filterIP(socket.conn.remoteAddress) === '127.0.0.1') ? socket.request.headers['x-forwarded-for'] : tools.filterIP(socket.conn.remoteAddress);

		log.debug(FILENAME + ' Funktion connect: Benutzer hat Websocket-Verbindung mit ID ' + socket.id + ' hergestellt. IP: ' + remoteAddress);
		log.debug('SOCKETHEADER' + socket.request.headers['x-forwarded-for']);
		// TODO: Pruefung Berechtigung !

		funktionNachVerbindungsaufbau(socket.id, remoteAddress); //letzten Schaltzustandübertragen

		// Uebertragen der DUE Server Zustaende
		exports.emit('statusMessage', dueStatusServerA, socket.id);
		exports.emit('statusMessage', dueStatusServerB, socket.id);

		socket.on('*', function (msg) {
			log.debug(FILENAME + ' Funktion * message: ' + JSON.stringify(msg))
		});

		socket.on('mock message', function (msg) {
			socket.broadcast.emit('mock message', msg);
			log.debug(FILENAME + ' Funktion mock message: ' + JSON.stringify(msg))
		});
		socket.on('chat message', function (msg) {
			//io.emit('chat message', msg);
			log.debug('chat message: ' + JSON.stringify(msg));
			const remoteAddress = (tools.filterIP(socket.conn.remoteAddress) === '127.0.0.1') ? socket.request.headers['x-forwarded-for'] : tools.filterIP(socket.conn.remoteAddress);
			vif.sendeWebServiceNachricht(remoteAddress, msg.FstID, msg.SPAN, msg.aktion, msg.Kanal);//Zum Testen eine Schleife als SIP Nachricht, die wieder als Web Nachricht zurueckgesendet wird
		});

		//'Standardnachrichten für Weiterleitung an RFD schalten,trennen, MKA'
		socket.on('clientMessage', function (msg) {
			log.debug(FILENAME + ' Funktion: empfangeWebNachricht ' + 'clientMessage: WebSocket Nachricht: ' + JSON.stringify(msg));
			const remoteAddress = (tools.filterIP(socket.conn.remoteAddress) === '127.0.0.1') ? socket.request.headers['x-forwarded-for'] : tools.filterIP(socket.conn.remoteAddress);
			vif.sendeWebServiceNachricht(remoteAddress, msg.FstID, msg.SPAN, msg.aktion, msg.Kanal, msg.span_mhanApNr, msg.ApID); //Sende WebServiceNachricht an RFD
		});

		//Speichern der Kanal Lotsenzuordnung
		socket.on('clientMessageSpeichern', function (msg) {
			log.info(FILENAME + ' Funktion: empfangeWebNachricht ' + 'clientMessageSpeichern: WebSocket Nachricht: ' + JSON.stringify(msg));

			// TODO: Funktion erstellen und in DB auslagern
			//Speichern
			// for (const LotsenAp in msg.LotsenApBenutzer) {
			// speichereLotsenZuordnung(LotsenAp, JSON.stringify(msg.LotsenApBenutzer[LotsenAp]))
			// }
		});

		// Client hat Verbindung unterbrochen:
		socket.on('disconnect', function (msg) {
			const remoteAddress = (tools.filterIP(socket.conn.remoteAddress) === '127.0.0.1') ? socket.request.headers['x-forwarded-for'] : tools.filterIP(socket.conn.remoteAddress);

			log.warn(FILENAME + ' Funktion disconnect: Benutzer hat Websocket-Verbindung mit ID ' + socket.id + ' getrennt. IP: ' + remoteAddress);

			// Benutzer ermitteln und Trennung in Datenbank schreiben
			db.ladeBenutzer(remoteAddress, {}, function (benutzer) {
				if (typeof benutzer.user != 'string') {
					return;
				}
				db.schreibeApConnect(remoteAddress, socket.id, benutzer.user, cfg.alternativeIPs[0][0], false);
			});
		});

	});
};


//Zum Senden von UKW bezogenen Nachrichten
exports.sendeWebSocketNachricht = function (Nachricht) {
	log.info(FILENAME + ' Funktion: sendeWebSocketNachricht ' + 'ukwMsg: WebSocket Nachricht: ' + JSON.stringify(Nachricht));
	exports.emit('ukwMessage', Nachricht);
};

//Zum Senden von Status-Meldungen
exports.sendeWebsocketNachrichtStatus = function (Nachricht) {
	log.debug(FILENAME + ' Funktion: sendeWebsocketNachrichtStatus ' + 'statusMsg: WebSocket Nachricht: ' + JSON.stringify(Nachricht));
	exports.emit('statusMessage', Nachricht);
};

//Zum Senden von Status-Meldungen
exports.sendeWebsocketNachrichtServer = function (Nachricht) {
	log.debug(FILENAME + ' Funktion: sendeWebsocketNachrichtServer ' + 'ServerMsg: WebSocket Nachricht: ' + JSON.stringify(Nachricht));
	exports.emit('serverMessage', Nachricht);
};


exports.emit = function emit(messagetype, message, socketID) {
	log.debug(FILENAME + ' Funktion: socket.emit MessageType: ' + messagetype + '  message: ' + JSON.stringify(message));

	if (socketID == undefined) {
		log.debug(FILENAME + ' Funktion emit: emitting messages to clients...');
		return socketServer.emit(messagetype, message);
	}


	if (socketID) {
		log.debug(FILENAME + ' Funktion emit: emitting messages to client: ' + socketID);
		return socketServer.to(socketID).emit(messagetype, message);
	}

	/** Pruefung ob Clients verbunden sind
	 if () {
        log.error(FILENAME + " Funktion emit: no client connected, not able to send message "+ messagetype);
    }

	 **/
};

/**
 * TODO: Funktion kann entfernt werden. Da jede einzelne Zustandmeldung übertragen wird
 * Neu: Verwendung von /verbindungen/liesZustand
 * Lese Zustandsmeldungen in zustandKomponenten
 * {"FSTSTATUS":{"$":{"id":"1-H-RFD-WEDRAD-FKHK-1","state":"0","connectState":"OK","channel":"-1"}}}
 * @param {string} socketID
 */
function leseZustand(socketID) {
	const selector = {};
	db.findeElement('zustandKomponenten', selector, function (doc) {
		for (let i = 0; i < doc.length; i++) {
			const zustand = {
				'FSTSTATUS': {
					'$':             doc[i].status,
					'letzteMeldung': doc[i].letzteMeldung
				}
			};
			exports.emit('ukwMessage', zustand, socketID);
		}
	})
}

/**
 * Einlesen des Schaltzustands und übermittlung bei connect
 * und eintragen der Socket Verbindungsparameter
 * @param {string} socketID
 * @param {string} ip
 */
function funktionNachVerbindungsaufbau(socketID, ip) {
	const zustand = {};

	if (typeof ip != 'string') {
		return;
	}

	db.ladeBenutzer(ip, {}, function (benutzer) {

		if (typeof benutzer.user != 'string') {
			return;
		}

		const selector = {
			ApID:                    benutzer.user,
			'zustand.aufgeschaltet': true
		};

		// Schaltzustaender finden und an socketID uebertreagen
		db.findeElement('schaltZustaende', selector, function (doc) {
			if (doc.length > 0) {
				// doc = JSON.parse(doc);
				for (const verbindung of doc) {
					//erstelle Objekt nach Muster 1-H-RFD-WHVVTA-FKEK-1:MHAN01
					//In Verbindung mit der AP Konfuguration der Geaete kann der Client die Verbindungen wieder schalten
					zustand[verbindung.funkstelle] = verbindung.span_mhanApNr
				}
				log.debug(FILENAME + 'leseSchaltzustand ' + util.inspect(zustand));
				exports.emit('zustandsMessage', zustand, socketID)
			}
			else {
				log.error(FILENAME + ' Funktion: leseSchaltzustand aus DB:' + util.inspect(doc))
			}
		});

		// Verbindungsdaten in Datenbank schreiben
		db.schreibeApConnect(ip, socketID, benutzer.user, cfg.alternativeIPs[0][0], true);
		//leseZustand(); //TODO: spaeter diesen Funktionsaufruf sowie die Funktion leseZustand() wieder entfernen
	})
}

/**
 * Ueberwachung der jeweils anderen DUE Server. Dazu wird zu jedem anderen Server
 * eine WebSocket Vwerbindung aufgebaut. Und dieser Server ist dann ein Client fuer
 * anderen. Uber diesen Weg erhaelt dieser Server auch die Erreichbarkeit des RFD im
 * anderen VTR via Nachricht: serverMessage.
 * @return {[type]} [description]
 */
function starteDueServerUberwachung() {
	const serverA = cfg.alternativeIPs[1]; // z.B. { '0': 'WHV', '1': '10.160.1.64' }
	const serverB = cfg.alternativeIPs[2];

	log.info(FILENAME + ' ...starte Pruefung DUE Server Erreichbarkeit fuer Server: '
		+ serverA);
	log.info(FILENAME + ' ...starte Pruefung DUE Server Erreichbarkeit fuer Server: '
		+ serverB);

	// Server A
	const client_bei_serverA = socketClient.connect('http://' + serverA[1] + ':' + cfg.port);
	log.info('Funktion: Serverueberwachung SOCKET Verbinungsaufbau mit: ' + serverA);

	client_bei_serverA.on('connect', function () {
		log.info('Funktion: Serverueberwachung SOCKET verbunden mit: ' + serverA);
		exports.emit('statusMessage', {dienst: 'DUE', status: {URL: serverA[1], Status: 'OK'}});
		dueStatusServerA = {dienst: 'DUE', server: serverA[0], status: {URL: serverA[1], Status: 'OK'}};
		db.schreibeZustand(dueStatusServerA)
	});

	client_bei_serverA.on('connect_error', function (err) {
		log.error('Funktion: Serverueberwachung SOCKET connect_error zu: ' + serverA + ' ErrorMsg: ' + JSON.stringify(err));
		exports.emit('statusMessage', {dienst: 'DUE', status: {URL: serverA[1], Status: 'Error'}});
		dueStatusServerA = {
			dienst: 'DUE',
			server: serverA[0],
			status: {URL: serverA[1], Status: 'Error', StatusMsg: err}
		};
		db.schreibeZustand(dueStatusServerA)
	});

	client_bei_serverA.on('disconnect', function () {
		log.error('Funktion: Serverueberwachung SOCKET getrennt von: ' + serverA);
		exports.emit('statusMessage', {dienst: 'DUE', status: {URL: serverA[1], Status: 'Error'}});
		dueStatusServerA = {dienst: 'DUE', server: serverA[0], status: {URL: serverA[1], Status: 'Error'}};
		db.schreibeZustand(dueStatusServerA)
	});

	client_bei_serverA.on('error', function (err) {
		log.debug('Funktion: Serverueberwachung SOCKET getrennt von: ' + serverA);
		log.error('Funktion: Serverueberwachung SOCKET getrennt von: ' + serverA + ' ErrorMsg: ' + JSON.stringify(err));
		exports.emit('statusMessage', {dienst: 'DUE', status: {URL: serverA[1], Status: 'Error'}});
		dueStatusServerA = {
			dienst: 'DUE',
			server: serverA[0],
			status: {URL: serverA[1], Status: 'Error', StatusMsg: err}
		};
		db.schreibeZustand(dueStatusServerA)
	});

	client_bei_serverA.on('reconnecting', function (reconnectNr) {
		log.info('Funktion: Serverueberwachung SOCKET reconnecting zu: ' + serverA + ' Nr: ' + JSON.stringify(reconnectNr))
	});

	client_bei_serverA.on('reconnect_error', function (err) {
		log.error('Funktion: Serverueberwachung SOCKET reconnect_error zu: ' + serverA + ' ErrorMsg: ' + JSON.stringify(err));
		exports.emit('statusMessage', {dienst: 'DUE', status: {URL: serverA[1], Status: 'Error'}});
		dueStatusServerA = {
			dienst: 'DUE',
			server: serverA[0],
			status: {URL: serverA[1], Status: 'Error', StatusMsg: err}
		};
		db.schreibeZustand(dueStatusServerA)
	});

	// ServerB
	const client_bei_serverB = socketClient.connect('http://' + serverB[1] + ':' + cfg.port);
	log.info('Funktion: Serverueberwachung SOCKET Verbinungsaufbau mit: ' + serverB);

	client_bei_serverB.on('connect', function () {
		log.info('Funktion: Serverueberwachung SOCKET verbunden mit: ' + serverB);
		exports.emit('statusMessage', {dienst: 'DUE', status: {URL: serverB[1], Status: 'OK'}});
		dueStatusServerB = {dienst: 'DUE', server: serverB[0], status: {URL: serverB[1], Status: 'OK'}};
		db.schreibeZustand(dueStatusServerB)
	});

	client_bei_serverB.on('connect_error', function (err) {
		log.error('Funktion: Serverueberwachung SOCKET connect_error zu: ' + serverB + ' ErrorMsg: ' + JSON.stringify(err));
		exports.emit('statusMessage', {dienst: 'DUE', status: {URL: serverB[1], Status: 'Error'}});
		dueStatusServerB = {
			dienst: 'DUE',
			server: serverB[0],
			status: {URL: serverB[1], Status: 'Error', StatusMsg: err}
		};
		db.schreibeZustand(dueStatusServerB)
	});

	client_bei_serverB.on('disconnect', function () {
		log.error('Funktion: Serverueberwachung SOCKET getrennt von: ' + serverB);
		exports.emit('statusMessage', {dienst: 'DUE', status: {URL: serverB[1], Status: 'Error'}});
		dueStatusServerB = {dienst: 'DUE', server: serverB[0], status: {URL: serverB[1], Status: 'Error'}};
		db.schreibeZustand(dueStatusServerB)
	});

	client_bei_serverB.on('error', function (err) {
		log.debug('Funktion: Serverueberwachung SOCKET getrennt von: ' + serverB);
		log.error('Funktion: Serverueberwachung SOCKET getrennt von: ' + serverB + ' ErrorMsg: ' + JSON.stringify(err));
		exports.emit('statusMessage', {dienst: 'DUE', status: {URL: serverB[1], Status: 'Error'}});
		dueStatusServerB = {
			dienst: 'DUE',
			server: serverB[0],
			status: {URL: serverB[1], Status: 'Error', StatusMsg: err}
		};
		db.schreibeZustand(dueStatusServerB)
	});

	client_bei_serverB.on('reconnecting', function (reconnectNr) {
		log.info('Funktion: Serverueberwachung SOCKET reconnecting zu: ' + serverB + ' Nr: ' + JSON.stringify(reconnectNr))
	});

	client_bei_serverB.on('reconnect_error', function (err) {
		log.error('Funktion: Serverueberwachung SOCKET reconnect_error zu: ' + serverB + ' ErrorMsg: ' + JSON.stringify(err));
		exports.emit('statusMessage', {dienst: 'DUE', status: {URL: serverB[1], Status: 'Error'}});
		dueStatusServerB = {
			dienst: 'DUE',
			server: serverB[0],
			status: {URL: serverB[1], Status: 'Error', StatusMsg: err}
		};
		db.schreibeZustand(dueStatusServerB)
	});

	client_bei_serverA.on('serverMessage', function (msg) {
		log.debug('Status von Server A: ' + JSON.stringify(msg));
		exports.emit('statusMessage', msg)
	});

	client_bei_serverB.on('serverMessage', function (msg) {
		log.debug('Status von Server B: ' + JSON.stringify(msg));
		exports.emit('statusMessage', msg)
	});
}

starteDueServerUberwachung();
