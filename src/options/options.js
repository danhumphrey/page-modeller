import Vue from 'vue/dist/vue.runtime.esm';
import Vuetify from 'vuetify';
import OptionsApp from './OptionsApp';

import '../styles/material.scss';
import 'vuetify/dist/vuetify.css';
import colours from '../styles/colours.scss';

Vue.config.devtools = false;

Vue.use(Vuetify, {
  theme: {
    highlight: colours.active,
    primary: '#BDBDBD',
    secondary: '#607D8B',
    accent: colours.active,
    error: '#f44336',
    warning: '#ffeb3b',
    info: '#2196f3',
    success: '#4caf50',
  },
});

(() =>
  new Vue({
    el: '#app',
    render: h => h(OptionsApp),
  }))();
