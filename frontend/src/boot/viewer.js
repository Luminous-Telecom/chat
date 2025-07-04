import { boot } from 'quasar/wrappers'
import VueViewer from 'v-viewer'
import 'viewerjs/dist/viewer.css'

export default boot(({ app }) => {
  app.use(VueViewer)
}) 