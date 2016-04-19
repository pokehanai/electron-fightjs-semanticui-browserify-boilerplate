'use strict';

import { defineComponent } from 'flight';

module.exports = defineComponent(component);

function component() {
  this.attributes({
    nodeVerSelector: '.node',
    chromeVerSelector: '.chrome',
    electronVerSelector: '.electron',
  });

  this.after('initialize', function () {
    this.on(document, 'data.info.served', function (e, { versions }) {
      this.select('nodeVerSelector').text(versions.node);
      this.select('chromeVerSelector').text(versions.chrome);
      this.select('electronVerSelector').text(versions.electron);
    });

    this.trigger('data.info.requested');
  });
}
