'use strict'

import "babel-polyfill";
import $ from "jquery";
import { advice, component, compose, debug, logger, registry, utils } from 'flightjs'
import { remote } from 'electron'

window.$ = $;

if (remote.process.env.NODE_ENV == 'develop') {
  debug.enable(true);
  debug.events.logAll();
}
compose.mixin(registry, [advice.withAdvice]);

require('./data/data').attachTo(document);
require('./ui/ui').attachTo('#info');
