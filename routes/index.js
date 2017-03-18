'use strict';

const express = require('express');
const router  = express.Router();
const util    = require('util');
const files   = require('fs'); // Zugriff auf das Dateisystem
const tools   = require('../tools.js');

const cfg = require('../cfg.js');
const log = require('../log.js'); // Modul fuer verbessertes Logging
const vif = require('../vifWs.js');

const db = require('../datenbank.js');

const FILENAME = __filename.slice(__dirname.length + 1);

const qis = require('../qisWs.js');

/* GET home page. */
router.get('/', function (req, res, next) {
	res.redirect('/ukw');
});

/* GET UKW uebersicht */
router.get('/overview', function (req, res) {
	const Funkstellen = vif.getFunkstellen();
	if (Funkstellen.length === 0) {
		log.error('Topologie nicht eingelesen, wird aber jetzt gebraucht, mit Fehler antworten!');
		res.status(404)        // HTTP status 404: NotFound
			.send('ukwKonfig konnte nicht geladen werden.');
	}
	else {
		res.render('ukwOverview', {
			'funkstellen': Funkstellen
		});
	}
});

/* GET Zuordnung */
router.get('/zuordnung', function (req, res) {
	db.ladeBenutzer(req.ip, res, function (benutzer) {
		log.debug('Benutzer: ' + benutzer);
		log.info(FILENAME + ' Funktion router.get /zuordnung Arbeitsplatz gefunden! IP: ' + tools.filterIP(req.ip));

		// TODO: ueberpruefen, ob hier das Richtige uebergeben wird:
		erstelleKonfigFuerLotsenKanal(benutzer.user, false, function (konfig) {
			//Uebergebe Funkstellen ID an Jade Template
			log.info(FILENAME + ' Funktion router.get /zuordnung Konfig: ' + konfig);
			res.render('zuordnung', {
				'gesamteKonfig': konfig
			});
		});
	});
});

/* GET UKW Test */
router.get('/testen', function (req, res) {
	res.render('testen', {
		'funkstellen': vif.getFunkstellen()
	});
});

/* GET UKW Dokumentation */
router.get('/dokumentation', function (req, res) {
	const konfig = {
		IpConfig:            {
			aktuellerServer:      cfg.aktuellerServer,
			alternativeIPs:       cfg.alternativeIPs,
			displaySperreTimeout: cfg.displaySperreTimeout
		}
	};
	const dateien = files.readdirSync('dokumentation')
	const dateiNamen = []
	for (const datei of dateien) {
		const ohneEndung = datei.split('.')
		dateiNamen.push(ohneEndung[0])
	}

	let dokPugVorlage            = files.readFileSync('views/technik/dokumentationInhalt.pug')
	const vorherigeDokPugVorlage = dokPugVorlage;

	dokPugVorlage = 'block content\n';

	for (const name of dateiNamen) {
		const ueberschrift = '  h1#' + name + ' ' + name + '\n';
		const include      = '    include:markdown-it ../../dokumentation/' + name + '.md\n'
		dokPugVorlage += ueberschrift;
		dokPugVorlage += include;
	}

	if (vorherigeDokPugVorlage !== dokPugVorlage) {
		files.writeFileSync('views/technik/dokumentationInhalt.pug', dokPugVorlage)
	}
	res.render('technik/dokumentationNav', {dateien: dateiNamen, gesamteKonfig: konfig})
});

/* GET UKW Status */
router.get('/status', function (req, res) {
	const konfig = {
		IpConfig:            {
			aktuellerServer:      cfg.aktuellerServer,
			alternativeIPs:       cfg.alternativeIPs,
			displaySperreTimeout: cfg.displaySperreTimeout
		}
	};

	res.render('technik/status', {gesamteKonfig: konfig});
});

/* GET UKW Status */
router.get('/tabelle', function (req, res) {
	const konfig = {
		IpConfig: cfg
	}
	res.render('technik/tabelle', {
		//gesamteKonfig: konfig,
		datei: req.query.dokument});

});


/* GET UKW Display */
router.get('/ukw', function (req, res) {

	const clientIP = tools.filterIP(req.ip);
	log.debug('Benutzer IP: ' + clientIP);

	db.ladeBenutzer(clientIP, res, function (benutzer) {

		log.debug(FILENAME + ' Funktion: /ukw ladeBenutzer IP: ' + clientIP);

		erstelleKonfigFurAp(benutzer.user, function (konfig, errString) {
			if (konfig == 'Fehler') {
				res.render('error', {
					message: 'keine Konfiguration zu Arbeitsplatz: ' + benutzer.user + ' Fehler: ' + errString,
					error:   {
						status: 'kein'
					}
				});
			}
			else {
				//Uebergebe Funkstellen ID an Pug Template
				log.info('ukw - konfigfuerAP: an Pug Template uebergeben');
				//ukwDisplay --> zum Testen eines neuen Layouts

				res.render('entwicklung/ukwDisplayTest', {
					stringify:           require('js-stringify'),
					log,  // logging auch im Jade-Template moeglich!
					'gesamteKonfig':     konfig,
					'aktuellerBenutzer': benutzer

				}); //res send ende
			}
		}); //erstelleKonfigFurAp Ende
	});
}); //router Ende

/* GET UKW Display */
router.get('/ukwAlt', function (req, res) {

	const clientIP = tools.filterIP(req.ip);
	log.debug('Benutzer IP: ' + clientIP);

	db.ladeBenutzer(clientIP, res, function (benutzer) {

		log.debug('ukw - Ermittelter Benutzer: ' + util.inspect(benutzer.user));


		log.debug(FILENAME + ' *** Arbeitsplatz gefunden! IP: ' + tools.filterIP(req.ip));
		erstelleKonfigFurAp(benutzer.user, function (konfig, errString) {
			if (konfig == 'Fehler') {
				res.render('error', {
					message: 'keine Konfiguration zu Arbeitsplatz: ' + benutzer.user + ' Fehler: ' + errString,
					error:   {
						status: 'kein'
					}
				});
			}
			else {
				//Uebergebe Funkstellen ID an Pug Template
				log.info('ukw - konfigfuerAP: an Pug Template uebergeben');
				//ukwDisplay --> zum Testen eines neuen Layouts
				res.render('ukwDisplay', {
					log,  // logging auch im Jade-Template moeglich!
					'gesamteKonfig': konfig

				}); //res send ende
			}
		}); //erstelleKonfigFurAp Ende
	});
}); //router Ende


/* GET UKW Display */
router.get('/ukwTestWue', function (req, res) {

	const clientIP = tools.filterIP(req.ip);
	log.debug('Benutzer IP: ' + clientIP);

	db.ladeBenutzer(clientIP, res, function (benutzer) {
		log.debug('ukw - Ermittelter Benutzer: ' + benutzer);
		log.debug(FILENAME + ' *** Arbeitsplatz gefunden! IP: ' + tools.filterIP(req.ip));
		erstelleKonfigFurAp(benutzer.user, function (konfig, errString) {
			if (konfig == 'Fehler') {
				res.render('error', {
					message: 'keine Konfiguration zu Arbeitsplatz: ' + benutzer.user + ' Fehler: ' + errString,
					error:   {
						status: 'kein'
					}
				});
			}
			else {
				//Uebergebe Funkstellen ID an Jade Template
				log.info('ukw - konfigfuerAP: an Jade Template uebergeben');
				//ukwDisplay --> zum Testen eines neuen Layouts
				res.render('entwicklung_wuellner/ukwDisplayTest', {
					log,  // logging auch im Jade-Template moeglich!
					'gesamteKonfig': konfig

				}); //res send ende
			}
		}); //erstelleKonfigFurAp Ende
	});
}); //router Ende


/* GET UKW Konfiguration
 *
 * TODO wenn die Konfiguration noch nicht eingelesen ist in Funkstellen, dann warten bis verfuegbar, nach Timeout mit Fehler antworten, Fehlerhandling clientseitig
 * */
router.get('/ukwKonfig', function (req, res) {
	log.warn(FILENAME + ' Funktion: router get /ukwKonfig von IP: ' + tools.filterIP(req.ip), +'   IP-Parameter: ' + util.inspect(req.query));

	const Funkstellen = vif.getFunkstellen();
	if (Funkstellen.length === 0) {
		log.error('Topologie nicht eingelesen, wird aber jetzt gebraucht, mit Fehler antworten!');
		res.status(404)        // HTTP status 404: NotFound
			.send('ukwKonfig konnte nicht geladen werden.');
	}
	else {
		if (typeof req.query.ip == 'string') { // /ukwKonfig mit Parameter z.B. ukwKonfig?ip=1.1.1.1
			db.ladeBenutzer(req.query.ip, res, function (benutzer) {
				log.debug(FILENAME + ' Benutzer zu IP  = ' + benutzer.user + ' ' + req.query.ip);
				erstelleKonfigFurAp(benutzer.user, function (Konfig) {
					res.send(Konfig);
				});
			});
			// }
		}

		// /ukwKonfig mit Parameter ?zuordnung=lotse
		// TODO: Ueberarbeitung im Zuge der Funktion Zuordnung notwendig
		if (typeof req.query.zuordnung == 'string' && req.query.zuordnung == 'lotse') {
			db.ladeBenutzer(req.ip, res, function (benutzer) {
				if (req.query.standard == 'true') {
					erstelleKonfigFuerLotsenKanal(benutzer.user, 'true', function (Konfig) {
						res.send(Konfig);
					});
				}
				if (req.query.standard == 'false') {
					erstelleKonfigFuerLotsenKanal(benutzer.user, 'false', function (Konfig) {
						res.send(Konfig);
					});
				}
			});
		}
		else { // ukwkonfig ohne parameter
			db.ladeBenutzer(req.ip, res, function (benutzer) {
				log.debug(FILENAME + ' Funktion: router get /ukwKonfig ermittelter User: ' + benutzer.user);
				// TODO: testen, ob hier das richtige passiert
				erstelleKonfigFurAp(benutzer.user, function (Konfig) {
					if (typeof Konfig != 'object') {
						Konfig = {};
					}

					res.send({
						'Konfigdaten':  Konfig,
						'Arbeitsplatz': benutzer.user
					});
				});
			});
		}
	} // if(Funkstellen.length==0)

});//Router /ukwKonfig Ende

// TODO: ungenutzen code entfernen?
// router.get('/liesTopologie', function (req, res) {
// 	log.info(FILENAME + ' Topologie neu einlesen.');
// 	rfd.leseRfdTopologie(function () {
// 		res.send(rfd.Funkstellen);
// 	});
// });

router.get('/mockmessage', function (req, res) {
	//log.debug(FILENAME + ' mockmessage von IP: ' + tools.filterIP(req.ip) + ", message: "+ require('util').inspect( req) );
	const msgText = req.query.messageText;
	log.debug(FILENAME + ' mockmessage messageText: ' + msgText);
	qis.sendeSipNachricht(msgText, function (result, error) {
		if (result == 'OK') {
			res.send('Abgesendet: ' + error.replace('<', '').replace('/>', ''));
		}
		else {
			res.send('Fehler: ' + error.prototype.message);
		}

	});

});

router.get('/arbeitsplaetze', function (req, res) {
	let arbeitsplaetze; // = require(cfg.configPath + '/users/arbeitsplaetze.json')
	files.readFile('config/users/arbeitsplaetze.json', 'utf8', function (err, data) {
		if (err) {
			log.error(err);
			res.status(404).send('Fehler beim Einlesen der Arbeitsplatzkonfiguration');
		}
		else {
			arbeitsplaetze = JSON.parse(data);
			log.debug(FILENAME + ' Funktion: /arbeitplaetze Arbeitplaetze geladen: ' + JSON.stringify(arbeitsplaetze));
			res.send(arbeitsplaetze);
		}
	});
});

router.get('/lieskonfig', function (req, res) {
	let configdata;
	const configfile = req.query.configfile;
	files.readFile('config/revier/' + configfile + '.json', 'utf8', function (err, data) {
		if (err) {
			log.error(err);
			res.status(404).send('Fehler beim Einlesen der Konfiguration ' + configfile + ' ' + err);
		}
		else {
			configdata = JSON.parse(data);
			log.debug(FILENAME + 'configfile: ' + JSON.stringify(configdata));
			res.send(configdata);
		}
	});
});


vif.leseRfdTopologie(function () {
	log.info(FILENAME + ' leseRfdTopologie: Topologie eingelesen.');
});

/**
 * Konfigurationsobjekt fuer den Arbeitsplatz erstellen.
 * Einlesen der Konfig.Dateien
 * TODO: Fehlermeldung und Errorhandling wenn keine Konfig vorliegt
 * @param {string} Ap
 * @param {function} callback
 */
function erstelleKonfigFurAp(Ap, callback) {

	//Bilde temporaeres Objekt um Funkstelle als Value hinzuzufuegen
	const Konfig = {
		FunkstellenReihe:    [],
		FunkstellenDetails:  {},
		ArbeitsplatzGeraete: {},
		MhanZuordnung:       {},
		IpConfig:            {
			aktuellerServer:      cfg.aktuellerServer,
			alternativeIPs:       cfg.alternativeIPs,
			displaySperreTimeout: cfg.displaySperreTimeout
		},

		KanalListe: [],
		LotsenAp:            {},
	};

	log.debug(FILENAME + ' uebergebener Arbeitsplatz: ' + Ap);
	const rev_ap = Ap.split(' ');

	//1. Funkkstellen fuer Revier einlesen
	//Dateinamen noch durch Variable ersetzen
	const revieranteil = rev_ap[0];
	db.liesAusRESTService(revieranteil, function (response1) {
		log.debug(FILENAME + ' response1: ' + JSON.stringify(response1));
		if (typeof response1 === 'string' && response1.indexOf('Fehler') > -1) {
			callback('Fehler', response1);
		}
		else {
			const fstReihe = response1;
			//Durch JA ueber Buttons iterieren
			for (const button in fstReihe) {
				log.debug(FILENAME + ' Button: ' + button + '  ' + fstReihe[button]);
				//Durch Funkstelln in Buttons iterien
				for (let t = 0; t < fstReihe[button].length; t++) {

					//Funkstellendetails schreiben
					if (fstReihe[button][t] != '') {
						// Pruefen auf gwid und ggf. in Konfig. einspeisen
						const fstDetails = vif.findeFstNachId(fstReihe[button][t])
						if (fstDetails.hasOwnProperty('gwId')) {
							Konfig.FunkstellenDetails[fstReihe[button][t]]  = fstDetails.fstId;
							Konfig.FunkstellenDetails[fstDetails.gwId.id] = fstDetails.gwId;
						}
						else {
							Konfig.FunkstellenDetails[fstReihe[button][t]] = fstDetails;
						}

						//Kanalnummern in Array schreiben. Dient zur dynamischen Befüllung im MKA Dialog
						const kanalNummer = Konfig.FunkstellenDetails[fstReihe[button][t]].channel;
						if (kanalNummer != undefined && kanalNummer !== null) {
							Konfig.KanalListe.push(kanalNummer);
						}
					}
				}
			}
			//KanalListe sortieren und Doppel entfernen. Hilfsfunktionen siehe weiter unten.
			Konfig.KanalListe.sort(tools.vergleicheZahlen);
			Konfig.KanalListe       = tools.entferneDoppel(Konfig.KanalListe);
			Konfig.FunkstellenReihe = fstReihe;

			//2. Geraete fuer Arbeitsplatz einlesen
			//Dateinamen noch durch Variable ersetzen
			// log.debug(' -- 1');
			db.liesAusRESTService(rev_ap[0] + '_' + rev_ap[1], function (response2) {
				if (typeof response2 === 'string' && response2.indexOf('Fehler') > -1) {
					callback('Fehler', response2);
				}
				else {
					// log.debug(' -- 2');
					Konfig.ArbeitsplatzGeraete = response2;
					if (response2.hasOwnProperty('Funkstellen')) {
						Konfig.FunkstellenReihe = response2.Funkstellen;
						// Ueberschreibe Konfig.ArbeitsplatzGeraete, da bei Lotsen auch die
						// Funkstellen in der Konfig enthalten sind
						delete response2.Funkstellen
						Konfig.ArbeitsplatzGeraete = response2;
					}

					//3. MHAN Zuordnung fuer Arbeitsplatz einlesen
					//Dateinamen noch durch Variable ersetzen
					db.liesAusRESTService(rev_ap[0] + '_' + rev_ap[1] + '_mhan_zuordnung', function (response3) {
						if (typeof response3 === 'string' && response3.indexOf('Fehler') > -1) {
							callback('Fehler', response3);
						}
						else {
							// log.debug(' -- 3');
							Konfig.MhanZuordnung = response3;
							//----------------------------------------------------------------------------------------
							//Hier die Callback fuer die Res.send einbauen, die die Rueckmeldung aus Konfig benoetigt
							leseLotsenAp(revieranteil, function(alleLotsenAp){
								for (const lotsenAp in alleLotsenAp) {
									//SPAN Details schreiben fuer Sname in GUI
									if (alleLotsenAp[lotsenAp].SPAN01 != '') {
										console.log(alleLotsenAp[lotsenAp].SPAN01)
										const spanDetails = vif.findeFstNachId(alleLotsenAp[lotsenAp].SPAN01)
										if (spanDetails == null) {
											console.log('Error')
										}
										else {
											Konfig.FunkstellenDetails[alleLotsenAp[lotsenAp].SPAN01] = spanDetails;
										}
									}
								}

								Konfig.LotsenAp = alleLotsenAp
								callback(Konfig);
							})

						}//Else Ende
					});
				}//Else Ende
			});
		}//Else Ende
	});
} //Funktion Ende

/**
 * TODO: Funktion löschen, da vielleiht nicht mehr benoetigt
 * @param {string} Ap
 * @param {boolean} standard
 * @param {function} callback
 */
function erstelleKonfigFuerLotsenKanal(Ap, standard, callback) {
	const Konfig = {
		FunkstellenReihe:   [],
		FunkstellenDetails: {},
		LotsenAp:           {},
		MhanZuordnung:      {},
		IpConfig:           cfg
	};

	log.debug(FILENAME + ' Funktion erstelleKonfigFuerLotsenKanal erhaltener Arbeitsplatz: ' + Ap);
	const rev_ap           = Ap.split(' ');
	const standardbenutzer = standard ? '' : '_benutzer';  // wenn standard == true, dann default Einstellungen laden, wenn false dann _benutzer Einstellungen laden

	//1. Funkkstellen fuer Revier einlesen
	//Dateinamen noch durch Variable ersetzen, hier zum Lesen der VTA fuer das Revier
	const revieranteil = rev_ap[0];
	db.liesAusRESTService(revieranteil, function (response) {
		const fstReihe = response;
		log.debug(FILENAME + ' Funktion erstelleKonfigFuerLotsenKanal readFile(' + revieranteil + ') gelesene Daten: ' + fstReihe);
		//Durch JA ueber Buttons iterieren
		for (const button in fstReihe) {
			log.debug(button + '  ' + fstReihe[button]);
			//Durch Funkstelln in Buttons iterien
			for (let t = 0; t < fstReihe[button].length; t++) {
				// TODO Funkstellendetails schreiben HIER MEHR ERKLAEREN
				Konfig.FunkstellenDetails[fstReihe[button][t]] = vif.findeFstNachId(fstReihe[button][t]);
			}
		}

		//Alle LotsenAP einlesen
		//ueber alle Lotsendateien //JA_Lotse1.json usw. gehen und Inhalt in die Konfig schreiben

		let i            = 1;
		let weitereDatei = true;  //solange true bis keine weitere Datei vorliegt
		while (weitereDatei === true) {
			try {
				weitereDatei = files.statSync(cfg.configPath + rev_ap[0] + '_Lotse' + i + '.json').isFile();
				const tmp    = files.readFileSync(cfg.configPath + rev_ap[0] + '_Lotse' + i + standardbenutzer + '.json', 'utf8');
				log.debug(FILENAME + ' Funktion erstelleKonfigFuerLotsenKanal gelesene Daten: ' + util.inspect(tmp));
				Konfig.LotsenAp[rev_ap[0] + '_Lotse' + i] = JSON.parse(tmp);

			}
			catch (error) {
				//log.debug(error)
				log.debug(FILENAME + ' keine weitere Datei ' + cfg.configPath + rev_ap[0] + '_Lotse' + i + '.json');
				callback(Konfig);
				return;
			}
			i++; //pruefen ob noch benoetigt!
		} //While Ende
	});
} //Funktion Ende

function leseLotsenAp (revier, callback) {
	//Alle LotsenAP einlesen
	//ueber alle Lotsendateien //JA_Lotse1.json usw. gehen und Inhalt in die Konfig schreiben
	const lotsenAp   = {};
	let i            = 1;
	let weitereDatei = true;  //solange true bis keine weitere Datei vorliegt
	while (weitereDatei === true) {
		try {
			weitereDatei = files.statSync('config/revier/' + revier + '_lotse' + i + '.json').isFile();
			const tmp    = JSON.parse(files.readFileSync('config/revier/' + revier + '_lotse' + i + '.json', 'utf8'));
			log.debug(FILENAME + ' Funktion erstelleKonfigFuerLotsenKanal gelesene Daten: ' + util.inspect(tmp));
			delete tmp.Funkstellen;
			lotsenAp[revier + '_lotse' + i] = tmp;
			//console.log(lotsenAp[revier + '_lotse' + i])
		}
		catch (error) {
			//log.debug(error)
			log.debug(FILENAME + ' keine weitere Datei ' + 'config/revier/' + revier + '_lotse' + i + '.json');
			callback(lotsenAp);
			return;
		}
		i++;
	} //While Ende
}

module.exports = router;
