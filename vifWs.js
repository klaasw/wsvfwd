'use strict';
/**
 * Modul zur Herstellung der Verbindung zum VIF/VIS Dienst
 * Erstellt für die Wasserstraßen und Schifffahrtsverwaltung
 * TODO: Code enstprechend anpassen, da die aus dem Beispiel des RFD stammt
 * @Author: Klaas Wüllner (WSV), xxx (IBM)
 */
const cfg    = require('./cfg.js');
const log    = require('./log.js'); // Modul fuer verbessertes Logging
const socket = require('./socket.js');

const db = require('./datenbank.js'); // Module zur Verbindung zur Datenbank

const request = require('request'); //Modul zu Abfrage von WebServices
const xml2js  = require('xml2js'); // zum Konvertieren von XML zu JS
const parser  = new xml2js.Parser({
	explicitRoot: false
}); // Parserkonfiguration

const FILENAME = __filename.slice(__dirname.length + 1);

const Funkstellen = {};

exports.getFunkstellen = function () {
	return Funkstellen;
};

/* Funkstellen vom RFD einlesen
 */
exports.leseRfdTopologie = function (callback) {

	const parameterRfdWebService = {
		url:     cfg.urlRFDWebservice,
		method:  'POST',
		headers: {
			'Content-Type': 'text/xml;charset=UTF-8;',
			'SOAPAction':   'GetTopologyForRFD' //Noch beachten in WS Aufrufen
		},
		body:    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:strg="http://strg.rfd.dma.schnoor.de/"><soapenv:Header/><soapenv:Body><strg:GetTopologyForRFD/></soapenv:Body></soapenv:Envelope>'
	};

	request(parameterRfdWebService, function (error, response, body) {
		if (error) {
			log.error(FILENAME + ' RFD WebService Topologie nicht erreichbar ' + error);
			// TODO: Leseversuch wiederholen, muss spaetestens dann existieren, wenn ein Client sich connecten will
			setTimeout(exports.leseRfdTopologie(function () {
				log.debug('fertig mit LeseRfdTopologie');
			}), 1000);
		}
		//log.debug(response)
		//log.debug(body)
		//Response paarsen
		else { //Ausfuehren wenn RFD erreichbar
			parser.parseString(body, function (err, result) {
				if (result !== undefined) {
					log.info(FILENAME + ' LeseTopologie webservice response: ' + JSON.stringify(result).substring(1, 100) + '...');
					//log.debug(result['S:Body'][0]['ns2:GetTopologyForRFDResponse'][0]['return'][0])
					const ergebnis1cdata = result['S:Body'][0]['ns2:GetTopologyForRFDResponse'][0]['return'][0];
					//CDATA Objekt der Response erneut parsen
					parser.parseString(ergebnis1cdata, function (err, result) {

						//Einzelkanal-Anlagenauslesen und in Funkstellen variable schreiben
						if (result['FKEK']) { //Pruefung ob Wert enthalten ist. In Referenz sind z.B. keine HK Anlagen
							const FstEK = result['FKEK'];
							for (let i = 0; i < FstEK.length; i++) {
								//log.debug(FstEK[i]['$'])
								const tmp         = FstEK[i]['$'];
								tmp.MKA           = false;
								tmp.aufgeschaltet = false; //default Zustand für Varbeitung von Schaltzuständen
								//log.debug(tmp)
								//unoetige Variablen entfernen
								delete tmp.ipaddr;
								delete tmp.portsip;
								delete tmp.portrtp;
								Funkstellen[tmp.id] = tmp;
							}
						}

						//HK-Anlagenauslesen und in Funkstellen variable schreiben
						if (result['FKHK']) { //Pruefung ob Wert enthalten ist. In Referenz sind z.B. keine HK Anlagen
							const FstHK = result['FKHK'];
							for (let i = 0; i < FstHK.length; i++) {
								//log.debug(FstEK[i]['$'])
								const tmp         = FstHK[i]['$'];
								tmp.MKA           = false;
								tmp.aufgeschaltet = false; //default Zustand für Varbeitung von Schaltzuständen
								//log.debug(tmp)
								//unoetige Variablen entfernen
								delete tmp.ipaddr;
								delete tmp.portsip;
								delete tmp.portrtp;
								Funkstellen[tmp.id] = tmp;

							}
						}

						//Mehrkanal-Anlagenauslesen und in Funkstellen variable schreiben
						if (result['FKMK']) { //Pruefung ob Wert enthalten ist. In Referenz sind z.B. keine HK Anlagen
							const FstMK = result['FKMK'];
							for (let i = 0; i < FstMK.length; i++) {
								//log.debug(FstMK[i]['$'])
								const tmp         = FstMK[i]['$'];
								tmp.MKA           = true;
								tmp.aufgeschaltet = false; //default Zustand für Varbeitung von Schaltzuständen
								//log.debug(tmp)
								//unoetige Variablen entfernen
								delete tmp.ipaddr;
								delete tmp.portsip;
								delete tmp.portrtp;
								Funkstellen[tmp.id] = tmp;

							}
						}

						//Gleichwellen-Anlagen auslesen und in Funkstellen variable schreiben
						if (result['FKGW']) { //Pruefung ob Wert enthalten ist. In Referenz sind z.B. keine HK Anlagen
							const FstGW = result['FKGW'];
							for (let i = 0; i < FstGW.length; i++) {
								//log.debug(FstMK[i]['$'])
								const tmp         = FstGW[i]['$'];
								tmp.MKA           = false;
								tmp.GW            = true;
								tmp.aufgeschaltet = false; //default Zustand für Varbeitung von Schaltzuständen
								//log.debug(tmp)
								//unoetige Variablen entfernen
								delete tmp.ipaddr;
								delete tmp.portsip;
								delete tmp.portrtp;
								Funkstellen[tmp.id] = tmp;

								//Erzeuge Pseudo-Funkstelle mit GW-ID
								if (!Funkstellen.hasOwnProperty(tmp.gwid)) {
									Funkstellen[tmp.gwid] = {
										'id': tmp.gwid,
										'Funkstellen': {},
										'sname': tmp.sname,
										'channel':tmp.channel
									}
								}
								Funkstellen[tmp.gwid].Funkstellen[tmp.id] = tmp
							}
						}

						//SPAN auslesen und in Funkstellen variable schreiben
						if (result['SPAN']) { //Pruefung ob Wert enthalten ist. In Referenz sind z.B. keine HK Anlagen
							const Span = result['SPAN'];
							for (let i = 0; i < Span.length; i++) {
								//log.debug(FstMK[i]['$'])
								const tmp         = Span[i]['$'];
								//log.debug(tmp)
								//unoetige Variablen entfernen
								delete tmp.ipaddr;
								delete tmp.portsip;
								delete tmp.portrtp;
								Funkstellen[tmp.id] = tmp;
							}
						}
						callback();
						//log.debug(Funkstellen)
						//log.debug(result['FKMK'])
						//log.debug(result['SPAN'])
						//log.debug(result['MHAN'])


					}); //Parser 2 ende
				} // if ende
			}); // Parser ende
		} // Else ende

	}); // Request ende
};


/**
 * TODO: hier Datenbankzugriff auf ZustandKOmponenten?
 * @param Id
 * @returns {string,boolean}
 */
exports.findeFstNachId = function (Id) {
	if (Id === undefined || Id === 'frei' || Id === '') {
		return 'frei';
	}
	else {
		if (Funkstellen.hasOwnProperty(Id)) {
			if (Id.indexOf('FKGW') > -1) {
				return {
					fstId : Funkstellen[Id],
					gwId  : Funkstellen[Funkstellen[Id].gwid]
				}
			}
			else {
				return Funkstellen[Id];
			}
		}
	}
	log.error('Funkstellen ID nicht vorhanden: \'' + Id + '\'');

	return 'frei';
};

/**
 * Block zur Implementierung der WebService Abfragen an RFD
 * TODO: noch erforderlich? ApID in Client ergaenzen damit Schaltzustand zum AP geschrieben werden kann
 * @param {string} ipAddr
 * @param {string} Fst
 * @param {string} Span_Mhan
 * @param {string} aktion
 * @param {string} Kanal
 * @param {string} span_mhanApNr
 * @param {string} ApID
 */
exports.sendeWebServiceNachricht = function (ipAddr, Fst, Span_Mhan, aktion, Kanal, span_mhanApNr, ApID) {
	const parameterRfdWebService = {
		url:     cfg.urlRFDWebservice,
		method:  'POST',
		headers: {
			'Content-Type': 'text/xml;charset=UTF-8;',
			'SOAPAction':   'PLATZHALTER'                      //NOch beachten in WS Aufrufen
		},
		body:    ''
	};
	let antwortFuerWebsocket     = {};

	if (aktion == 'trennenEinfach') {
		//Variable fuer RFD Request
		const msg_TrennenEinfach                  = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><trennenEinfach xmlns="http://strg.rfd.dma.schnoor.de/"><vonId xmlns="">' + Span_Mhan + '</vonId><nachId xmlns="">' + Fst + '</nachId></trennenEinfach></s:Body></s:Envelope>';
		//Variable fuer true Rueckmeldung vom RFD
		antwortFuerWebsocket                      = {getrennt: {'$': {id: Fst, Ap: Span_Mhan, state: '1'}}};
		parameterRfdWebService.headers.SOAPAction = 'trennenEinfach';
		parameterRfdWebService.body               = msg_TrennenEinfach
	}

	if (aktion == 'schaltenEinfach') {
		//Variable fuer RFD Request
		const msg_SchaltenEinfach                 = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><schaltenEinfach xmlns="http://strg.rfd.dma.schnoor.de/"><vonId xmlns="">' + Span_Mhan + '</vonId><nachId xmlns="">' + Fst + '</nachId><duplex xmlns="">true</duplex></schaltenEinfach></s:Body></s:Envelope>';
		//Variable fuer true Rueckmeldung vom RFD
		antwortFuerWebsocket                      = {geschaltet: {'$': {id: Fst, Ap: Span_Mhan, state: '1'}}};
		parameterRfdWebService.headers.SOAPAction = 'schaltenEinfach';
		parameterRfdWebService.body               = msg_SchaltenEinfach
	}

	if (aktion == 'setzeKanal') {
		//Variable fuer RFD Request
		const msg_setzeKanal = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><setzeKanal xmlns="http://strg.rfd.dma.schnoor.de/"><fstid xmlns="">' + Fst + '</fstid><channel xmlns="">' + Kanal + '</channel></setzeKanal></s:Body></s:Envelope>';
		//Variable fuer true Rueckmeldung vom RFD

		//Websocket Antwort kann entfallen. Bestaetigung wird als SIP NAchricht vom RFD DM versendet
		antwortFuerWebsocket                      = {setzeKanal: {'$': {id: Fst, Ap: Span_Mhan, state: '1'}}};
		parameterRfdWebService.headers.SOAPAction = 'setzeKanal';
		parameterRfdWebService.body               = msg_setzeKanal
	}

	if (aktion == 'SetzeAudioPegel') {
		//Variable fuer RFD Request
		const msg_setzeAudioPegel = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><SetzeAudioPegel xmlns="http://strg.rfd.dma.schnoor.de/"><apid xmlns="">' + Span_Mhan + '</apid><fstid xmlns="">' + Fst + '</fstid><level xmlns="">' + Kanal + '</level></SetzeAudioPegel></s:Body></s:Envelope>';
		//Variable fuer true Rueckmeldung vom RFD

		//Variable fuer true Rueckmeldung vom RFD
		antwortFuerWebsocket                      = {SetzeAudioPegel: {'$': {id: Fst, Ap: Span_Mhan, state: '1'}}};
		parameterRfdWebService.headers.SOAPAction = 'SetzeAudioPegel';
		parameterRfdWebService.body               = msg_setzeAudioPegel
	}

	log.debug('parameterRfdWebService.headers.SOAPAction: ' + parameterRfdWebService.headers.SOAPAction);

	request(parameterRfdWebService, function (error, response, body) {
		log.debug(FILENAME + ' Funktion: sendeWebServiceNachricht request mit Parameter: ' + JSON.stringify(parameterRfdWebService));
		if (error) {
			log.error(FILENAME + ' Funktion: sendeWebServiceNachricht request ' + 'Msg: RFD WebService nicht erreichbar. Aktion: ' + aktion, {
				uebergabe: parameterRfdWebService,
				nodeMsg:   error
			});

			socket.sendeWebSocketNachricht('RFD ' + aktion + ' fehlgeschlagen');

		}
		else {
			log.debug(FILENAME + ' parsing response');
			parser.parseString(body, function (err, result) {
				//log.debug(FILENAME + ' result  ' + JSON.stringify(result));
				if (result !== undefined && result !== null && typeof result === 'object') {
					let erfolgreich;
					if (result['S:Envelope'] !== undefined) {
						//log.debug(FILENAME + ' Funktion: sendeWebServiceNachricht response: ' + JSON.stringify(result));
						//console.log(result['S:Envelope'])
						//console.log(result['S:Envelope']['S:Body'][0]['ns2:'+aktion+'Response'][0])
						erfolgreich = result['S:Envelope']['S:Body'][0]['ns2:' + aktion + 'Response'][0]['return'][0];
					}
					else {
						erfolgreich = result['S:Body'][0]['ns2:' + aktion + 'Response'][0]['return'][0];
					}
					log.debug(FILENAME + ' Funktion: sendeWebServiceNachricht response: ' + erfolgreich);
					if (erfolgreich === 'true') {
						// TODO: Beobachten ob es hier zu Timing Problem beim Schalten oder
						// Wechsel Gruppenschaltung/ Einzelschaltung kommt, da parallel in DB geschrieben
						// und Rueckmeldung an Client gesendet wird. Der Client ruft nach erhalt den Zustand
						// wieder ab.
						if (aktion == 'schaltenEinfach' || aktion == 'trennenEinfach') {
							db.schreibeSchaltzustand(ipAddr, Fst, Span_Mhan, aktion, span_mhanApNr, ApID)
						}

						socket.sendeWebSocketNachricht(antwortFuerWebsocket);
					}
					else {
						log.error('RFD ' + aktion + ' fehlgeschlagen');
						socket.sendeWebSocketNachricht('RFD ' + aktion + ' fehlgeschlagen');

						//TODO: Bei False Verarbeitung muss RFD muss nicht gestört sein. Abfangen
						//socket.sendeWebsocketNachrichtStatus({
						//    RfdStatus: {
						//        URL: cfg.urlRFDWebservice,
						//        Status: 'Error'
						//    }
						//});
					}
					// } else {
					//     // TODO: Client ggf. informieren, dass der letzte Request nicht verarbeitet werden konnte - anders als der healthcheck ist die Ursache aber vielfaeltiger
					//     log.error(FILENAME + ' no envelope');
					// }
				}
				else {
					// TODO: Client ggf. informieren, dass der letzte Request nicht verarbeitet werden konnte - anders als der healthcheck ist die Ursache aber vielfaeltiger
					log.error(FILENAME + ' result undefined or unexpected');
				}
			}); // Parser ende
		}// ELse ende
	}); // Request ende
};
