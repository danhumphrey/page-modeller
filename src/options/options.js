import Vue from 'vue/dist/vue.runtime.esm';
import Vuetify from 'vuetify';
import OptionsApp from './OptionsApp';

import '../styles/material.scss';
import 'vuetify/dist/vuetify.css';
import colours from '../styles/colours.scss';

Vue.config.devtools = true;
Vue.use(Vuetify, {
  theme: {
    highlight: colours.active,
  },
});

// eslint-disable-next-line no-new
new Vue({
  el: '#app',
  render: h => h(OptionsApp),
});
