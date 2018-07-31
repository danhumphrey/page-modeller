// this should go into panel.js

import Vue from "vue/dist/vue.common";
import Vuetify from 'vuetify';
import App from "../templates/App.vue";

Vue.use(Vuetify);

new Vue({
  el: "#app",
  render: h => h(App)
});
