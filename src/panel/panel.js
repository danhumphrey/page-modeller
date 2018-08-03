import Vue from 'vue/dist/vue.common';
import Vuetify from 'vuetify';
import App from './App';

import './panel.css';
import 'vuetify/dist/vuetify.css';

Vue.use(Vuetify);

new Vue({
  el: '#app',
  render: h => h(App),
});
