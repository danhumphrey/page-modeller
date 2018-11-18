import Vue from 'vue/dist/vue.runtime.esm';
import Vuetify from 'vuetify';
import App from './App';

import '../styles/material.scss';
import 'vuetify/dist/vuetify.css';

Vue.config.devtools = false;
Vue.use(Vuetify, {
  options: {
    customProperties: true,
  },
});

(() =>
  new Vue({
    el: '#app',
    render: h => h(App),
  }))();
