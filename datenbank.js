'use strict';
/**
 * Modul zur Herstellung der Verbindung zur Mongo Datenbank
 *
 * @Author: Klaas Wuellner && Felix Stolle
 *
 * Anpassung 14.12.16: Timeouts auskommentiert, nur in pruefeLokaleVerbindung/
 * VTR lokale DB auskommentiert -> bei Ausfall nodeJS muesste auch Mongo primary
 * wechseln.
 * @Author: Klaas Wuellner
 *
 */

const MongoClient = require('mongodb').MongoClient;
const assert      = require('assert');
const util        = require('util');

const cfg   = require('./cfg.js');
const log   = require('./log.js');
const tools = require('./tools.js');

const request = require('request'); //Modul zu Abfrage von WebServices

const FILENAME = __filename.slice(__dirname.length + 1);

// Connection URL
const user_auth  = (cfg.auth ? cfg.auth_user + ':' + cfg.auth_pw + '@' : '');
const replicaSet = (cfg.replicaSet !== '' ? '&replicaSet=' + cfg.replicaSet : '');
const url        = 'mongodb://' + user_auth + cfg.mongodb.join(',') + '/ukw?readPreference=nearest' + replicaSet;

const verbundenMitPrimary = false;

/**
 * Callback Funktion zum aufrufen nach Verbindungsaufbau
 * @callback dbCallback
 */

/**
 * Verbindung zur DB aufbauen und ggf. callback ausführen
 * @param {dbCallback} aktion
 */
exports.verbindeDatenbank = function (aktion) {

	log.debug(url);
	const _self = this;

	MongoClient.connect(url, {
		// connectTimeoutMS: 2000,
		// socketTimeoutMS: 2000
	}, function (err, db) {

		if (err) {
			// log.error(FILENAME + ' Funktion: verbindeDatenbank. err: ' + util.inspect(err));
			err.error = true;
			aktion(err);
			return;
		}

		// assert.equal(null, err);

		log.debug(FILENAME + ' Funktion: verbindeDatenbank. err: ' + util.inspect(err));
		log.debug(FILENAME + ' Funktion: verbindeDatenbank. Verbindung erfolgreich hergestellt:  topology: ' + db.topology + ', primary: ' + db.topology.isMasterDoc.primary + ', isMasterDoc:' + JSON.stringify(db.topology.isMasterDoc));
		datenbank.pruefeLokaleVerbindung(db.topology.isMasterDoc.primary);

		// if (err) throw err;

		exports.dbVerbindung = db;

		//Ereignislister fuer Topologie Aenderungen im ReplicaSet
		db.topology.on('serverDescriptionChanged', function (event) {
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener: received serverDescriptionChanged');
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener:' + JSON.stringify(event));
		});

		db.topology.on('serverHeartbeatStarted', function (event) {
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener: received serverHeartbeatStarted');
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener:' + JSON.stringify(event));
		});

		db.topology.on('serverHeartbeatSucceeded', function (event) {
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener: received serverHeartbeatSucceeded');
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener:' + JSON.stringify(event));
		});

		db.topology.on('serverHeartbeatFailed', function (event) {
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener: received serverHeartbeatFailed');
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener:' + JSON.stringify(event));
		});

		db.topology.on('serverOpening', function (event) {
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener: received serverOpening');
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener:' + JSON.stringify(event));
		});

		db.topology.on('serverClosed', function (event) {
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener: received serverClosed');
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener:' + JSON.stringify(event));
		});

		db.topology.on('topologyOpening', function (event) {
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener: received topologyOpening');
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener:' + JSON.stringify(event));
		});

		db.topology.on('topologyClosed', function (event) {
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener: received topologyClosed');
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener:' + JSON.stringify(event));
		});

		db.topology.on('topologyDescriptionChanged', function (event) {
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener: received topologyDescriptionChanged');
			log.debug(FILENAME + ' Funktion: verbindeDatenbank Listener:' + JSON.stringify(event));

			if (event.newDescription.topologyType == 'ReplicaSetWithPrimary') {
				datenbank.pruefeLokaleVerbindung(event.newDescription.servers[0].address);
			}
		});

		if (typeof aktion === 'function') {
			aktion(_self);
		}
	});
};

/**
 * vor dem Schreiben prüfen ob eine Verbindung besteht
 * @param {string} collection
 * @param {object} selector
 * @param {object} inhalt
 * @param {boolean} schreibeLokal
 */
//TODO: Prio 2 Verbindung zu unterschiedlichen Datenbanken herstellen. Damit WindowsBenutzer von ukw Datenbank entkoppelt sind
exports.schreibeInDb = function (collection, selector, inhalt, schreibeLokal) {
	if (exports.dbVerbindung === undefined) {
		log.error(FILENAME + ' schreibeInDb Datenbank ist noch nicht verbunden!!! Schreibversuch schlug fehl. Collection: ' + util.inspect(collection) + ', selector: ' + util.inspect(selector) + ', inhalt: ' + util.inspect(inhalt));
		log.error(FILENAME + ' schreibeInDb Versuche erneut in 3s');
		setTimeout(function () {
			exports.schreibeInDb(collection, selector, inhalt, schreibeLokal);
		}, 3000)
	}
	else {
		// TODO: abweichendes handling falls primary nicht verbunden
		if (verbundenMitPrimary === true && schreibeLokal === true) {
			datenbank.schreibeInDb(collection, selector, inhalt);
		}
		else {
			datenbank.schreibeInDb(collection, selector, inhalt);
		}
	}
};

/**
 * Lade Arbeitsplatzkonfiguration aus DB
 * @param {string} ipAddr - IP Adresse des Nutzers
 * @param {object} res - nodejs app resource
 * @param {function} callback
 */
exports.ladeAktiveArbeitsplaetze = function (ipAddr, res, callback) {

	exports.findeElement('AktiveArbeitsplaetze', {_id: tools.filterIP(ipAddr)}, function (doc) {
		if (doc.length) {
			if (typeof callback == 'function') {
				callback(doc[0]);
			}
		}
		else if (typeof res == 'object') {
			log.error(FILENAME + ' function ladeAktiveArbeitsplaetze: AP NICHT gefunden zu IP: ' + ipAddr);
			res.render('error', {
				message: 'Fehler! Kein AP zu dieser IP gefunden: ' + tools.filterIP(ipAddr),
				error:   {
					status: 'kein'
				}
			});
		}
		else {
			log.error(FILENAME + ' function ladeAktiveArbeitsplaetze: AP NICHT gefunden zu IP: ' + ipAddr);
			if (typeof callback == 'function') {
				callback({});
			}
		}
	})
};

/**
 * Generische funktion um in aktiveArbeitsplaetze zu schreiben
 * @param {string} id - benutzer id == ip
 * @param updateData - key:value welche aktualisiert werden sollen
 */
exports.schreibeAktiveArbeitsplaetze = function (id, updateData) {

	let ApInfo = {};
	id         = tools.filterIP(id);

	exports.ladeAktiveArbeitsplaetze(id, {}, function (ApData) {

		ApInfo = {
			$set: Object.assign({}, ApData, updateData)
		}

		const selector = {'_id': id};
		// exports.schreibeInDb('aktiveArbeitsplaetze', selector, ApInfo);
	});
};

/**
 * SocketID und Verbindungszeit in DB schreiben
 * @param {string} ip
 * @param {string} socketID
 * @param {string} benutzer
 * @param {string} server
 * @param {boolean} verbunden
 */
exports.schreibeApConnect = function (ip, socketID, benutzer, server, verbunden) {
	const strNeuVerbindungen = server + '.neuVerbindungen';
	const strVerbunden       = server + '.verbunden';
	const strVerbundenSeit   = server + '.verbundenSeit';
	const strLetzteTrennung  = server + '.letzteTrennung';
	const strSocketID        = server + '.socketID';

	let ApInfo = {};
	if (verbunden) {
		ApInfo = {
			$set: {
				'benutzer':         benutzer,
				[strVerbunden]:     verbunden,
				[strVerbundenSeit]: new Date(),
				[strSocketID]:      socketID,
			},
			$inc: {
				[strNeuVerbindungen]: 1
			}
		}
	}

	else {
		ApInfo = {
			$set: {
				[strVerbunden]:      verbunden,
				[strLetzteTrennung]: new Date(),
				[strSocketID]:       null
			}
		}
	}
	const selector = {'_id': ip};
	//Schreiben in aktiveArbeitsplaetze
	exports.schreibeInDb('aktiveArbeitsplaetze', selector, ApInfo, false);
};

/**
 * finde Dokumente in DB
 * @param {string} collection
 * @param {object} element
 * @param {function} callback
 */
exports.findeElement = function (collection, element, callback) {
	if (exports.dbVerbindung === undefined) {
		log.error('Datenbank ist noch nicht verbunden!!! Leseversuch schlug fehl: Collection: ' + util.inspect(collection) + ', element: ' + util.inspect(element));
		callback({});
	}
	else {
		datenbank.findeElement(collection, element, function (doc) {
			callback(doc);
		});
	}
};

/**
 * Generische funktion um in windowsBenutzer zu schreiben
 * @param {string} id - benutzer id == ip
 * @param {object} updateData - key:value welche aktualisiert werden sollen
 * @param {function} callback - funktion
 */
exports.schreibeBenutzer = function (id, updateData, callback) {

	let dbObj = {};
	id         = tools.filterIP(id);

	exports.ladeBenutzer(id, {}, function (ApData) {

		const benutzerNeu = Object.assign({}, ApData, updateData);

		dbObj = {
			$set: benutzerNeu
		};

		const selector = {'_id': id};
		exports.schreibeInDb('windowsBenutzer', selector, dbObj, false);

		if (typeof callback == 'function') {
			callback(benutzerNeu);
		}
	});
};

/**
 * Lade spezifischen windowsBenutzer aus DB
 * @param {string} ipAddr - IP Adresse des Nutzers
 * @param {object} res - nodejs app resource
 * @param {function} callback
 */
exports.ladeBenutzer = function (ipAddr, res, callback) {

	exports.findeElement('windowsBenutzer', {_id: tools.filterIP(ipAddr)}, function (doc) {
		if (doc.length) {
			if (typeof callback == 'function') {
				callback(doc[0]);
			}
		}
		else if (typeof res == 'object') {
			log.error(FILENAME + ' function ladeBenutzer: Benutzer NICHT gefunden zu IP: ' + ipAddr);
			res.render('error', {
				message: 'Fehler! Kein Benutzer zu dieser IP gefunden: ' + tools.filterIP(ipAddr),
				error:   {
					status: 'kein'
				}
			});
		}
		else {
			log.error(FILENAME + ' function ladeBenutzer: Benutzer NICHT gefunden zu IP: ' + ipAddr);
			if (typeof callback == 'function') {
				callback({});
			}
		}
	})
};

/**
 * Auslesen der Arbeitsplatzkonfigurationen:
 * Welche MHANs mit welchen Kanälen verbunden sind,
 * welche Schaltflächen existieren in welchem Revier und Arbeitsplatz
 * wie heissen die Arbeitsplatzgeräte in Kurzform (MHAN01 statt z.B. "1-H-RFD-WARVKZ-MHAN-11")
 * @param {string} configfile
 * @param {function} callback
 */
exports.liesAusRESTService = function (configfile, callback) {
	// require(cfg.configPath + configfile + '.json');
	log.debug('function liesAusRESTService ' + configfile);

	// TODO: auf Datenbank-Abfrage umstellen: erster Schritt REST-Service nutzen
	const url = 'http://localhost:' + cfg.port + '/lieskonfig?configfile=' + configfile;
	log.debug(FILENAME + ' liesAusRESTService url=' + url);
	request(url, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			const antwortImBody = JSON.parse(body);
			log.debug(FILENAME + ' liesAusRESTService response: ' + JSON.stringify(antwortImBody));
			callback(antwortImBody);
		}
		else {
			if (error) {
				log.error(FILENAME + ' liesAusRESTService Fehler: ' + JSON.stringify(error));
				callback('Fehler');//TODO: hier Fehlerhandling wenn Service nicht erreichbar
			}
			else {
				log.error(FILENAME + ' liesAusRESTService Fehler: ' + JSON.stringify(body));
				//log.error(" liesAusRESTService Fehler: " + JSON.stringify(response));
				callback(body);
			}
		}
	});
};

/**
 * schreibe Schaltzzustand in DB
 * @param {string} ipAddr
 * @param {string} fst
 * @param {string} Span_Mhan
 * @param {string} aktion
 * @param {string} span_mhanApNr
 * @param {string} ApID
 */
exports.schreibeSchaltzustand = function (ipAddr, fst, Span_Mhan, aktion, span_mhanApNr, ApID) {

	const schreibeLokal = false; //es wird auf jeden Fall geschrieben
	const selector      = {ApID, 'funkstelle': fst, 'span_mhan': Span_Mhan};
	let aufgeschaltet   = true;

	if (aktion == 'trennenEinfach') {
		aufgeschaltet = false
	}

	const schaltZustand = {
		ApID, // z.B. JA NvD
		'funkstelle': fst, // z.B. 1-H-RFD-WHVVTA-FKEK-1
		'span_mhan':  Span_Mhan, // z.B. 1-H-RFD-WHVVKZ-SPAN-01
		span_mhanApNr, // z.B. MHAN05
		'zustand':    {
			aufgeschaltet, // true - false
			'letzterWechsel': new Date().toJSON()
		}
	};

	exports.schreibeInDb('schaltZustaende', selector, schaltZustand, schreibeLokal);

	// nur SPAN in Benutzerconfig speichern
	if (span_mhanApNr.indexOf('SPAN') == -1) {
		return;
	}

	exports.ladeBenutzer(ipAddr, {}, function (benutzer) {

		if (typeof benutzer._id != 'undefined') {

			if (benutzer.einzel) {  // Einzelschaltung aktiv
				if (aufgeschaltet) {
					benutzer.schaltZustandEinzel = {[fst]: Span_Mhan};
				}
				else {
					delete benutzer.schaltZustandEinzel;
				}
			}
			else {                 // Gruppenschaltung aktiv
				if (aufgeschaltet) {
					benutzer.schaltZustandGruppe[fst] = Span_Mhan;
				}
				else {
					delete benutzer.schaltZustandGruppe[fst];
				}
			}

			const benutzerId        = {'_id': benutzer._id};
			const schreibeParameter = {
				$set: benutzer
			};

			exports.schreibeInDb('windowsBenutzer', benutzerId, schreibeParameter, false);
		}
	});
};

/**
 * schreibe Zustandsmeldungen von RFD Komponenten und Server(Module) in zustandKomponenten
 * @param {Object} Nachricht - {"FSTSTATUS":{"$":{"id":"1-H-RFD-WEDRAD-FKHK-1","state":"0","connectState":"OK","channel":"-1"}}}
 */
exports.schreibeZustand = function (Nachricht) {
	const schreibeLokal = true; // es wird nur geschrieben wenn die aktuelle Instanz und Mongo Primary in einem VTR sind
	// TODO: Pruefen ob in Wirksystem wirklich notwendig.
	// Dies wuerde da Umschaltverhalten kompliziert machen.
	let zustand;
	let komponentenTyp; // Komponententyp (Funkstelle oder SPAN oder MHAN) ermitteln

	if (Nachricht.hasOwnProperty('FSTSTATUS')) {
		komponentenTyp = (
			Nachricht.FSTSTATUS.$.id.indexOf('MHAN') || Nachricht.FSTSTATUS.$.id.indexOf('SPAN'))
				? 'span_mhan'
				: 'funkstelle';

		//entfernen da dieser sonst den Kanal im DUE wieder mit -1 ueberschreibt
		if (Nachricht.FSTSTATUS.$.channel == '-1') {
			zustand = {
				$set:         {
					letzteMeldung:         new Date(),
					'status.connectState': Nachricht.FSTSTATUS.$.connectState,
					'status.state':        Nachricht.FSTSTATUS.$.state,
				},
				$setOnInsert: {
					'komponentenTyp':      komponentenTyp,
					'status.id':           Nachricht.FSTSTATUS.$.id
				}
			}
		}
		else {
			zustand = {
				$set:         {
					letzteMeldung:         new Date(),
					'status.connectState': Nachricht.FSTSTATUS.$.connectState,
					'status.state':        Nachricht.FSTSTATUS.$.state,
					'status.channel':      Nachricht.FSTSTATUS.$.channel
				},
				$setOnInsert: {
					'komponentenTyp':      komponentenTyp,
					'status.id':           Nachricht.FSTSTATUS.$.id
				}
			}
		}

		//console.log(Nachricht.FSTSTATUS.$.id)
		const selector = {'_id': Nachricht.FSTSTATUS.$.id};

		exports.schreibeInDb('zustandKomponenten', selector, zustand, schreibeLokal);
	}

	if (Nachricht.hasOwnProperty('dienst')) {
		komponentenTyp = 'server';
		zustand = {
			$set: {
				[Nachricht.dienst]: {
					letzteMeldung: new Date(),
					status:        {
						url:   Nachricht.status.URL,
						state: Nachricht.status.Status,
						msg:   Nachricht.status.StatusMsg ? Nachricht.status.StatusMsg : 'keine'
					},
				},
			},
			$setOnInsert: {
				komponentenTyp: komponentenTyp,
			}
		};

		if (Nachricht.dienst === 'DUE') {
			const dueName = Nachricht.dienst + '.' + Nachricht.server;
			zustand       = {
				$set: {
					[dueName]: {
						letzteMeldung: new Date(),
						status:        {
							url:   Nachricht.status.URL,
							state: Nachricht.status.Status,
							msg:   Nachricht.status.StatusMsg ? Nachricht.status.StatusMsg : 'keine'
						},
					},
				},
				$setOnInsert: {
					komponentenTyp: komponentenTyp,
				}
			}
		}

		const selector = {'_id': cfg.alternativeIPs[0][0]};

		exports.schreibeInDb('zustandKomponenten', selector, zustand, schreibeLokal);
	}
	else {
		//nichts machen
	}
};

const datenbank = {

	/**
	 * Dokument aus Datenbank lesen
	 * @param {string} collection
	 * @param {object|int} element
	 * @param {function} callback
	 */
	findeElement(collection, element, callback) {
		const tmp      = exports.dbVerbindung.collection(collection);
		const selector = element || {};
		log.debug(FILENAME + ' Funktion: findeElement, collection: ' + collection + ', element: ' + JSON.stringify(element));

		if (isNaN(selector)) {
			tmp.find(selector).toArray(function (err, docs) {
				assert.equal(err, null);
				log.debug(FILENAME + ' Funktion: findeElement aus DB gelesen');
				callback(docs);
			});
		}
		else {
			collection.findOne({id: selector}, function (err, doc) {
				assert.equal(null, err);
				callback(doc);
			});
		}
	},

	/**
	 * Tatsächlich in DB schreiben, Ausführung als Upsert
	 * @param {string} collection
	 * @param {object} selector
	 * @param {object} inhalt
	 */
	schreibeInDb(collection, selector, inhalt) {
		log.debug(FILENAME + ' Funktion: schreibeInDb ' + util.inspect(collection) + ' -- ' + util.inspect(selector) + ' -- ' + util.inspect(inhalt));

		const db  = exports.dbVerbindung;
		const tmp = db.collection(collection);
		tmp.updateOne(selector, inhalt, {upsert: true, w: 1}).then(function (result) {
			assert.equal(1, result.result.n);
			log.debug(FILENAME + ' Funktion: schreibeInDb in DB geschrieben');
		});
	},

	/**
	 * Prueft ob der PRIMARY der Mongo-Datenbank und die Anwendung im selben VTR laufen und setzt die entsprechende Variable
	 * @param primaryServer
	 */
	pruefeLokaleVerbindung(primaryServer) {
		//Hostnamen teilen um Standort zu vergleichen
		const ukwServer       = cfg.aktuellerHostname.split('-');
		const primaryDbServer = primaryServer.split('-');

		//nur den Standort in Variable schreiben
		const ukwServerVTR       = ukwServer[1];
		const primaryDbServerVTR = primaryDbServer[1];

		//Standortpruefung
		const primary = (ukwServerVTR == primaryDbServerVTR);

		log.info(FILENAME + ' Funktion: pruefeLokaleVerbindung');
		log.debug(FILENAME + ' Funktion: pruefeLokaleVerbindung ukwServer=' + ukwServer + ' primaryDbServer=' + primaryDbServer + ' Ergebnis=' + primary);
	}
};
