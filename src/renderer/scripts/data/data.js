'use strict';

import { defineComponent } from '../flight';

module.exports = defineComponent(component);

function component() {
  this.after('initialize', function () {

    this.on('data.info.requested', function () {
      const { node, chrome, electron } = window.process.versions;
      this.trigger('data.info.served', { versions: { node, chrome, electron } });
    });
  });
}
