import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import { Notify } from 'quasar'

import routes from './routes.js'

// Ajuste para desativar error por navegação duplicada
// https://github.com/vuejs/vue-router/issues/2881#issuecomment-520554378
// const originalPush = VueRouter.prototype.push
// VueRouter.prototype.push = function push (location, onResolve, onReject) {
//   if (onResolve || onReject) { return originalPush.call(this, location, onResolve, onReject) }
//   return originalPush.call(this, location).catch((err) => {
//     if (VueRouter.isNavigationFailure(err)) {
//       // resolve err
//       return err
//     }
//     // rethrow error
//     return Promise.reject(err)
//   })
// }

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

const createHistory = process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory

const Router = createRouter({
  scrollBehavior: () => ({ left: 0, top: 0 }),
  routes,
  // Leave these as they are and change in quasar.config.js instead!
  // quasar.config.js -> build -> vueRouterMode
  // quasar.config.js -> build -> publicPath
  history: createHistory(process.env.VUE_ROUTER_BASE)
})

const whiteListName = [
  'login'
]

Router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')

  if (!token) {
    if (whiteListName.indexOf(to.name) == -1) {
      if (to.fullPath !== '/login' && !to.query.tokenSetup) {
        Notify.create({
          type: 'warning',
          message: 'Necessário realizar login',
          position: 'bottom-right'
        })
        next({ name: 'login' })
      } else {
        next()
      }
    } else {
      next()
    }
  } else {
    next()
  }
})

Router.afterEach(to => {
  window.scrollTo(0, 0)
})

export default Router
