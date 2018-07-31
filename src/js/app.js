// this should go into panel.js

import Vue from "vue/dist/vue.common";
import App from "../templates/App.vue";

new Vue({
  el: "#app",
  render: h => h(App)
});
