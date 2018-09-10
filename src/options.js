import Vue from 'vue/dist/vue.runtime.esm';
import Vuetify from 'vuetify';
import OptionsApp from './OptionsApp';

import './styles/material.scss';
import 'vuetify/dist/vuetify.css';

Vue.config.devtools = true;
Vue.use(Vuetify);

new Vue({
  el: '#app',
  render: h => h(OptionsApp),
});
