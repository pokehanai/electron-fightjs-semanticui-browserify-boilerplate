'use strict'

import "babel-polyfill";
import $ from "jquery";
import { advice, component, compose, debug, logger, registry, utils } from 'flightjs'

window.$ = $;

debug.enable(true);
compose.mixin(registry, [advice.withAdvice]);

require('./data/data').attachTo(document);
require('./ui/ui').attachTo('#info');
