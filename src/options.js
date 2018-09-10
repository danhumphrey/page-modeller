import Vue from 'vue/dist/vue.runtime.esm';
import Vuetify from 'vuetify';
import OptionsApp from './OptionsApp';

import './styles/material.scss';
import 'vuetify/dist/vuetify.css';
import './styles/settings.scss';

Vue.config.devtools = true;
Vue.use(Vuetify, {
  theme: {
    highlight: '#03a9f4',
  },
});

new Vue({
  el: '#app',
  render: h => h(OptionsApp),
});
