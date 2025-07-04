<template>
  <q-dialog
    title="流程数据信息"
    v-model="dialogVisible"
    width="70%"
  >
    <el-alert
      title="使用说明"
      type="warning"
      description="以下流程信息可以被存储起来，方便下一次流程加载"
      show-icon
      close-text="知道了"
    >
    </el-alert>
    <br />
    <!--一个高亮显示的插件-->
    <Codemirror
      v-model="flowJsonData"
      :extensions="extensions"
      class="code"
    />
  </q-dialog>
</template>

<script>
import { Codemirror } from 'vue-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'

export default {
  props: {
    data: Object
  },
  data () {
    return {
      dialogVisible: false,
      flowJsonData: {},
      extensions: [javascript()]
    }
  },
  components: {
    Codemirror
  },
  methods: {
    init () {
      this.dialogVisible = true
      this.flowJsonData = JSON.stringify(this.data, null, 4).toString()
    }
  }
}
</script>
