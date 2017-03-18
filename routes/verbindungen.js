'use strict';

const express = require('express');
const router = express.Router();
const util = require('util');
const cfg = require('../cfg.js'); //
const db = require('../datenbank.js');
const log = require('../log.js'); // Modul fuer verbessertes Logging
const FILENAME = __filename.slice(__dirname.length + 1);

/* liesVerbindungen aus Datenbank.
 *  TODO: Einbindung von Abfrage Parametern
 *
 *
 */
router.get('/liesVerbindungen', function (req, res) {
	log.debug(FILENAME + ' /liesVerbindungen: ' + JSON.stringify(req.query));

	// variabel fuer die Abfrageparameter. Undefined lassen
	// um ungueltige Abfragen an die Datenbank zu vermeiden
	let selector;
	let aktiveVerbindungen;
	if (req.query.revier) {
		const regex = new RegExp(req.query.revier);
		selector = {ApID: {$regex: regex}};
	}

	if (req.query.arbeitsplatz) {
		selector = {
			ApID: req.query.arbeitsplatz,
			'zustand.aufgeschaltet': true,
		};
	}

	if (req.query.funkstelle) {
		selector = {funkstelle: req.query.funkstelle};
	}

	if (req.query.geraet) {
		selector = {span_mhan: req.query.geraet};
	}

	//Selector erweitern wenn aktiveVerbindungen true oder false,
	//sonst werden alle Verbindungen ausgegeben.
	if (req.query.aktiveVerbindungen == 'true') {
		//selector.zustand = {}
		selector['zustand.aufgeschaltet'] = true;
	}

	if (req.query.aktiveVerbindungen == 'false') {
		//selector.zustand = {}
		selector['zustand.aufgeschaltet'] = false;
	}

	if (req.query.benutzerDefiniert) {
		console.log(JSON.parse(req.query.benutzerDefiniert));
		selector = JSON.parse(req.query.benutzerDefiniert);
	}

	if (selector !== undefined) {
		db.findeElement('schaltZustaende', selector, function (doc) {
			if (doc.length > 0) {
				res.send(doc);
			}
			else {
				res.send('keine Verbindungen für Abfrageparameter:' + JSON.stringify(req.query));
			}
		});
	}
	else {
		res.send('keine Verbindungen für Abfrageparameter:' + JSON.stringify(req.query) +
			' gültige Abfragen sind: ?revier=Revierkürzel oder ?arbeitsplatz=Revierkürzel' +
			' Leerzeichen Rolle oder ?funkstelle=Komponenten-ID'
		);
	}
});

router.get('/liesZustand', function (req, res) {
	log.debug(FILENAME + ' /liesZustand: ' + JSON.stringify(req.query));
	const selector = {};

	db.findeElement('zustandKomponenten', selector, function (doc) {
		if (doc.length > 0) {
			res.send(doc);
		}
		else {
			res.send('keine Verbindungen für Abfrageparameter:' + JSON.stringify(req.query));
		}
	});


});


module.exports = router;
