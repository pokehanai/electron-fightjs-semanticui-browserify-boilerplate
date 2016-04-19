'use strict';

import { defineComponent } from 'flight';
import tmpl from '../templates/version-item.hbs'

module.exports = defineComponent(component);

function component() {
  this.after('initialize', function () {
    this.on(document, 'data.info.served', function (e, { versions }) {
      let items = [
        { name: 'Node',
          image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Node.js_logo.svg/440px-Node.js_logo.svg.png',
          version: versions.node
        }, {
          name: 'Chronium',
          image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Google_Chrome_for_Android_Icon_2016.svg/128px-Google_Chrome_for_Android_Icon_2016.svg.png',
          version: versions.chrome
        }, {
          name: 'Electron',
          image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Electron_0.36.4_Icon.png/128px-Electron_0.36.4_Icon.png',
          version: versions.electron
        }
      ];

      let html = tmpl({ items });
      this.$node.empty().append(html);
    });

    this.trigger('data.info.requested');
  });
}
