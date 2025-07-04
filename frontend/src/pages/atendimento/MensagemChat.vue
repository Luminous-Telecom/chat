<!-- eslint-disable vue/valid-v-for -->
<template>
  <div class="q-pa-md">

    <transition-group
      appear
      enter-active-class="animated fadeIn"
      leave-active-class="animated fadeOut"
    >
      <div v-for="(mensagem, index) in mensagensComDatas" :key="`msg-wrapper-${mensagem.id}-${index}`">
        <hr
          v-if="mensagem._mostrarLinha"
          class="hr-text q-mt-lg q-mb-md"
          :data-content="mensagem._dataFormatada"
        />
        <div
          v-if="mensagens.length && index === mensagens.length - 1"
          ref="lastMessageRef"
          id="lastMessageRef"
          style="float: left; background: black; clear: both;"
        />
        <!-- Mensagens enviadas com avatar e nome -->
        <div
          v-if="mensagem.fromMe && mensagem._mostrarHeaderUsuario"
          class="user-message-container"
          :class="{ 'user-header-with-spacing': index > 0 }"
        >
          <div class="user-info-column">
            <span class="user-name-external">{{ getUserDisplayName(mensagem) }}</span>
            <q-chat-message
              :id="`chat-message-${mensagem.id}`"
              :stamp="dataInWords(mensagem.createdAt)"
              :sent="mensagem.fromMe"
              class="text-weight-medium"
              :class="{
                'pulseIdentications': identificarMensagem == `chat-message-${mensagem.id}`,
                'q-message-text--scheduled': mensagem.scheduleDate,
                'q-message-text--deleted': mensagem.isDeleted,
                'q-message-text--quoted': mensagem.quotedMsg,
                'q-message-text--group': isGroupLabel(mensagem),
                'q-message-text--media': ['image', 'video', 'audio'].includes(mensagem.mediaType),
                'q-message-text--audio': mensagem.mediaType === 'audio',
                'q-message-text--document': mensagem.mediaType === 'application',
                'q-message-text--contact': mensagem.mediaType === 'vcard',
                'q-message-text--forwarded': mensagem.isForwarded,
                'q-message-text--edited': mensagem.isEdited,
                'mensagem-hover-active': hoveredMessageId === mensagem.id
              }"
              @mouseenter="showMessageOptions(mensagem.id)"
              @mouseleave="hideMessageOptions(mensagem.id)"
              @dblclick="handleDoubleClick(mensagem)"
            >
              <div
                style="min-width: 100px; max-width: 350px;"
                :style="mensagem.isDeleted ? 'color: var(--text-color-secondary) !important; opacity: 0.6;' : ''"
              >
            <q-icon
              class="q-ma-xs"
              name="mdi-calendar"
              size="18px"
              :class="{
                  'text-primary': mensagem.scheduleDate && mensagem.status === 'pending',
                  'text-positive': !['pending', 'canceled'].includes(mensagem.status)
                }"
              v-if="mensagem.scheduleDate"
            >
              <q-tooltip content-class="bg-secondary text-grey-8">
                <div class="row col">
                  Mensagem agendada
                </div>
                <div
                  class="row col"
                  v-if="mensagem.isDeleted"
                >
                  <q-chip
                    color="red-3"
                    icon="mdi-trash-can-outline"
                  >
                    Envio cancelado: {{ formatarData(mensagem.updatedAt, 'dd/MM/yyyy') }}
                  </q-chip>
                </div>
                <div class="row col">
                  <q-chip
                    color="blue-1"
                    icon="mdi-calendar-import"
                  >
                    Criado em: {{ formatarData(mensagem.createdAt, 'dd/MM/yyyy HH:mm') }}
                  </q-chip>
                </div>
                <div class="row col">
                  <q-chip
                    color="blue-1"
                    icon="mdi-calendar-start"
                  >
                    Programado para: {{ formatarData(mensagem.scheduleDate, 'dd/MM/yyyy HH:mm') }}
                  </q-chip>
                </div>
              </q-tooltip>
            </q-icon>
            <div
              v-if="mensagem.isDeleted"
              class="text-italic"
            >
              Mensagem apagada em {{ formatarData(mensagem.updatedAt, 'dd/MM/yyyy') }}.
            </div>
            <div
              v-if="isGroupLabel(mensagem)"
              class="q-mb-sm"
              style="display: flex; color: var(--primary-color); font-weight: 500;"
            >
              {{ isGroupLabel(mensagem) }}
            </div>
            <div
              v-if="mensagem.quotedMsg"
              :class="{ 'textContentItem': !mensagem.isDeleted, 'textContentItemDeleted': mensagem.isDeleted }"
            >
              <MensagemRespondida
                class="row justify-center"
                @mensagem-respondida:focar-mensagem="focarMensagem"
                :mensagem="mensagem.quotedMsg"
                :ticketFocado="ticketFocado"
              />
            </div>
            <q-btn
              v-if=" !mensagem.isDeleted && isShowOptions "
              class="absolute-top-right mostar-btn-opcoes-chat mensagem-hover-btn"
              :class="{ 'q-btn--menu-open': $refs[`menu-${mensagem.id}`] && $refs[`menu-${mensagem.id}`][0]?.showing }"
              dense
              flat
              ripple
              round
              icon="mdi-chevron-down"
            >
              <q-menu
                :ref="`menu-${mensagem.id}`"
                square
                auto-close
                anchor="bottom left"
                self="top left"
                @hide="onMenuClose(mensagem.id)"
              >
                <q-list style="min-width: 100px">
                  <q-item
                    :disable="!['whatsapp', 'telegram'].includes(ticketFocado?.channel || '')"
                    clickable
                    @click="citarMensagem(mensagem)"
                  >
                                        <q-item-section>Responder</q-item-section>
                    <q-tooltip v-if="!['whatsapp', 'telegram'].includes(ticketFocado?.channel || '')">
                      Disponível apenas para WhatsApp e Telegram
                    </q-tooltip>
                  </q-item>
                  <q-separator />
                  <q-item
                    @click=" deletarMensagem(mensagem) "
                    clickable
                    v-if=" mensagem.fromMe "
                    :disable="isDesactivatDelete(mensagem) || ticketFocado?.channel === 'messenger'"
                  >
                    <q-item-section>
                      <q-item-label>Deletar</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
            <!-- Ícones de ACK para mensagens enviadas -->
            <div v-if="mensagem.fromMe" class="absolute-bottom-right q-pr-xs q-pb-xs ack-icons-container">
              <!-- Para ACK 5 (áudio ouvido), mostrar ícone de lido + ícone de ouvido -->
              <template v-if="mensagem.ack === 5 && mensagem.mediaType === 'audio'">
                <!-- Ícone de lido (check duplo) -->
                <q-icon
                  name="mdi-check-all"
                  size="1.2em"
                  color="blue-12"
                  class="ack-read-icon"
                />
                <!-- Ícone de ouvido (fone) -->
                <q-icon
                  name="mdi-headphones"
                  size="1.0em"
                  color="blue-12"
                  class="ack-played-icon"
                />
              </template>
              <!-- Para outros ACKs, comportamento normal -->
              <q-icon
                v-else
                :name="getAckIcon(mensagem.ack)"
                size="1.2em"
                :color="getAckColor(mensagem.ack)"
              />
            </div>
            <template v-if=" mensagem.mediaType === 'audio' ">
              <WhatsAppAudioPlayer
                :audioUrl="mensagem.mediaUrl"
                :isPTT="isAudioPTT(mensagem)"
                :isSent="mensagem.fromMe"
                :audioName="getAudioFileName(mensagem)"
                :showSpeedControl="true"
                :ackStatus="mensagem.ack || 0"
              />
            </template>
            <template v-if=" mensagem.mediaType === 'vcard' ">
              <q-btn
                type="a"
                :color=" $q.dark.isActive ? '' : 'black' "
                outline
                dense
                class="q-px-sm text-center btn-rounded "
                download="vCard"
                :href=" `data:text/x-vcard;charset=utf-8;base64,${returnCardContato(mensagem.body)}` "
              >
                Download Contato
              </q-btn>
            </template>
            <template v-if=" mensagem.mediaType === 'image' ">
              <div v-viewer>
                <img
                  :src="mensagem.mediaUrl"
                  class="img-preview-chat"
                  style="cursor: pointer; max-width: 280px; max-height: 200px; border-radius: 14px;"
                  alt="imagem do chat"
                />
              </div>
            </template>
            <template v-if=" mensagem.mediaType === 'video' ">
              <video
                :src=" mensagem.mediaUrl "
                controls
                class="q-mt-md"
                style="object-fit: contain;
                  width: 330px;
                  height: 150px;
                  border-top-left-radius: 8px;
                  border-top-right-radius: 8px;
                  border-bottom-left-radius: 8px;
                  border-bottom-right-radius: 8px;
                  background: #f5f5f5;
                "
              >
              </video>
            </template>
            <template v-if=" !['audio', 'vcard', 'image', 'video'].includes(mensagem.mediaType) && mensagem.mediaUrl ">
              <div class="text-center full-width no-scroll">
                <div
                  v-if=" isPDF(mensagem.mediaUrl) "
                  class="pdf-preview-container"
                  title="Clique para abrir PDF em nova guia"
                >
                  <!-- Preview moderno do PDF -->
                  <div class="pdf-preview-card">
                    <div class="pdf-preview-header">
                      <q-icon name="mdi-file-pdf-box" size="24px" color="red-6" />
                      <div class="pdf-preview-title-section">
                        <span class="pdf-preview-title">PDF</span>
                        <span class="pdf-preview-filename">{{ mensagem.mediaName || mensagem.body || 'Documento' }}</span>
                      </div>
                    </div>
                    <div class="pdf-preview-content">
                      <div class="pdf-preview-iframe-container">
                        <iframe
                          :src="mensagem.mediaUrl"
                          class="pdf-preview-iframe"
                          frameborder="0"
                          title="Preview do PDF"
                        >
                          Seu navegador não suporta visualização de PDF.
                        </iframe>
                      </div>
                    </div>
                    <div class="pdf-preview-actions">
                      <q-btn
                        color="primary"
                        label="Visualizar"
                        @click.stop.prevent="abrirPDFNovaGuia(mensagem.mediaUrl)"
                        class="pdf-action-btn"
                      />
                      <q-btn
                        color="primary"
                        label="Abrir em nova guia"
                        @click.stop.prevent="abrirPDFNovaGuia(mensagem.mediaUrl, true)"
                        class="pdf-action-btn"
                      />
                    </div>
                  </div>
                </div>
                <q-btn
                  type="a"
                  :color=" $q.dark.isActive ? '' : 'grey-3' "
                  no-wrap
                  no-caps
                  stack
                  dense
                  class="q-mt-sm text-center text-black btn-rounded  text-grey-9 ellipsis"
                  download
                  :target=" isPDF(mensagem.mediaUrl) ? '_blank' : '' "
                  :href=" mensagem.mediaUrl "
                >
                  <q-tooltip
                    v-if=" mensagem.mediaUrl "
                    content-class="text-bold"
                  >
                    Baixar: {{ mensagem.mediaName }}
                    <span v-html="formatarMensagemWhatsapp(mensagem.body)"></span>
                  </q-tooltip>
                  <div class="row items-center q-ma-xs ">
                    <div
                      class="ellipsis col-grow q-pr-sm"
                      style="max-width: 290px"
                      v-html="formatarMensagemWhatsapp(mensagem.body || mensagem.mediaName)"
                    >
                    </div>
                    <q-icon name="mdi-download" />
                  </div>
                </q-btn>
              </div>
            </template>
            <div
              v-linkified
              v-if=" !['vcard', 'application', 'audio'].includes(mensagem.mediaType) "
              :class=" { 'q-mt-sm': mensagem.mediaType !== 'chat' } "
              class="q-message-container row items-end no-wrap"
            >
              <div v-html="formatarMensagemWhatsapp(mensagem.body)" class="emoji-text"></div>
            </div>

            <!-- Botões Interativos -->
            <template v-if="mensagem.dataPayload && mensagem.dataPayload.buttons">
              <div class="row q-gutter-sm justify-start q-mt-sm">
                <q-btn
                  v-for="(button, btnIndex) in mensagem.dataPayload.buttons"
                  :key="btnIndex"
                  dense
                  outline
                  no-caps
                  color="primary"
                  class="q-px-sm"
                  :label="button.body || button.buttonText?.displayText || 'Botão'"
                  :loading="buttonStates[`button_${mensagem.id}_${btnIndex}`]?.loading"
                  :disabled="buttonStates[`button_${mensagem.id}_${btnIndex}`]?.disabled"
                  @click="handleButtonClick(mensagem, button, btnIndex)"
                />
              </div>
            </template>

            <!-- Lista Interativa -->
            <template v-if="mensagem.dataPayload && mensagem.dataPayload.title">
              <div class="row q-gutter-sm justify-start q-mt-sm">
                <q-card class="list-message-card" flat>
                  <q-card-section class="q-pa-sm">
                    <div class="text-subtitle2 text-weight-medium">{{ mensagem.dataPayload.title }}</div>
                    <div v-if="mensagem.dataPayload.description" class="text-caption q-mt-xs">
                      {{ mensagem.dataPayload.description }}
                    </div>
                  </q-card-section>
                  <q-card-section class="q-pa-sm q-pt-none" v-if="mensagem.dataPayload.buttons">
                    <q-btn
                      v-for="(section, sectionIndex) in mensagem.dataPayload.buttons"
                      :key="sectionIndex"
                      dense
                      outline
                      no-caps
                      color="primary"
                      class="q-px-sm q-mb-xs full-width"
                      :label="section.title || 'Opção'"
                      :loading="buttonStates[`section_${mensagem.id}_${sectionIndex}`]?.loading"
                      :disabled="buttonStates[`section_${mensagem.id}_${sectionIndex}`]?.disabled"
                      @click="handleListButtonClick(mensagem, section, sectionIndex)"
                    />
                  </q-card-section>
                </q-card>
              </div>
            </template>

            <!-- Indicador de Resposta de Botão -->
            <template v-if="mensagem.dataPayload && mensagem.dataPayload.isButtonResponse">
              <div class="row q-gutter-sm justify-start q-mt-xs">
                <q-chip
                  dense
                  color="positive"
                  text-color="white"
                  icon="mdi-check-circle"
                  class="q-px-sm"
                >
                  Resposta: {{ mensagem.dataPayload.buttonText }}
                </q-chip>
              </div>
            </template>
          </div>
        </q-chat-message>
          </div>
          <div class="user-avatar-external">
            <img
              v-if="getUserProfilePic(mensagem)"
              :src="getUserProfilePic(mensagem)"
              class="user-avatar-image"
              @error="showAvatarFallback"
              @load="hideAvatarFallback"
            />
            <div
              class="user-avatar-fallback-external"
              :class="{ 'avatar-fallback-hidden': getUserProfilePic(mensagem) }"
            >
              <q-icon name="mdi-account-outline" size="22px" color="white" />
            </div>
          </div>
        </div>

        <!-- Todas as outras mensagens (recebidas e enviadas agrupadas) -->
        <div
          v-else
          class="message-wrapper"
          :class="{ 'sent-message-wrapper': mensagem.fromMe }"
        >
          <q-chat-message
            :id="`chat-message-${mensagem.id}`"
            :stamp="dataInWords(mensagem.createdAt)"
            :sent="mensagem.fromMe"
            class="text-weight-medium"
            :class="{
              'pulseIdentications': identificarMensagem == `chat-message-${mensagem.id}`,
              'q-message-text--scheduled': mensagem.scheduleDate,
              'q-message-text--deleted': mensagem.isDeleted,
              'q-message-text--quoted': mensagem.quotedMsg,
              'q-message-text--group': isGroupLabel(mensagem),
              'q-message-text--media': ['image', 'video', 'audio'].includes(mensagem.mediaType),
              'q-message-text--audio': mensagem.mediaType === 'audio',
              'q-message-text--document': mensagem.mediaType === 'application',
              'q-message-text--contact': mensagem.mediaType === 'vcard',
              'q-message-text--forwarded': mensagem.isForwarded,
              'q-message-text--edited': mensagem.isEdited,
              'mensagem-hover-active': hoveredMessageId === mensagem.id,
              'mensagem-agrupada': !mensagem._mostrarHeaderUsuario && mensagem.fromMe
            }"
            @mouseenter="showMessageOptions(mensagem.id)"
            @mouseleave="hideMessageOptions(mensagem.id)"
            @dblclick="handleDoubleClick(mensagem)"
          >
          <div
            style="min-width: 100px; max-width: 350px;"
            :style="mensagem.isDeleted ? 'color: var(--text-color-secondary) !important; opacity: 0.6;' : ''"
          >
            <q-icon
              class="q-ma-xs"
              name="mdi-calendar"
              size="18px"
              :class="{
                  'text-primary': mensagem.scheduleDate && mensagem.status === 'pending',
                  'text-positive': !['pending', 'canceled'].includes(mensagem.status)
                }"
              v-if="mensagem.scheduleDate"
            >
              <q-tooltip content-class="bg-secondary text-grey-8">
                <div class="row col">
                  Mensagem agendada
                </div>
                <div
                  class="row col"
                  v-if="mensagem.isDeleted"
                >
                  <q-chip
                    color="red-3"
                    icon="mdi-trash-can-outline"
                  >
                    Envio cancelado: {{ formatarData(mensagem.updatedAt, 'dd/MM/yyyy') }}
                  </q-chip>
                </div>
                <div class="row col">
                  <q-chip
                    color="blue-1"
                    icon="mdi-calendar-import"
                  >
                    Criado em: {{ formatarData(mensagem.createdAt, 'dd/MM/yyyy HH:mm') }}
                  </q-chip>
                </div>
                <div class="row col">
                  <q-chip
                    color="blue-1"
                    icon="mdi-calendar-start"
                  >
                    Programado para: {{ formatarData(mensagem.scheduleDate, 'dd/MM/yyyy HH:mm') }}
                  </q-chip>
                </div>
              </q-tooltip>
            </q-icon>
            <div
              v-if="mensagem.isDeleted"
              class="text-italic"
            >
              Mensagem apagada em {{ formatarData(mensagem.updatedAt, 'dd/MM/yyyy') }}.
            </div>
            <div
              v-if="isGroupLabel(mensagem)"
              class="q-mb-sm"
              style="display: flex; color: var(--primary-color); font-weight: 500;"
            >
              {{ isGroupLabel(mensagem) }}
            </div>
            <div
              v-if="mensagem.quotedMsg"
              :class="{ 'textContentItem': !mensagem.isDeleted, 'textContentItemDeleted': mensagem.isDeleted }"
            >
              <MensagemRespondida
                class="row justify-center"
                @mensagem-respondida:focar-mensagem="focarMensagem"
                :mensagem="mensagem.quotedMsg"
                :ticketFocado="ticketFocado"
              />
            </div>
            <q-btn
              v-if=" !mensagem.isDeleted && isShowOptions "
              class="absolute-top-right mostar-btn-opcoes-chat mensagem-hover-btn"
              :class="{ 'q-btn--menu-open': $refs[`menu-${mensagem.id}`] && $refs[`menu-${mensagem.id}`][0]?.showing }"
              dense
              flat
              ripple
              round
              icon="mdi-chevron-down"
            >
              <q-menu
                :ref="`menu-${mensagem.id}`"
                square
                auto-close
                anchor="bottom left"
                self="top left"
                @hide="onMenuClose(mensagem.id)"
              >
                <q-list style="min-width: 100px">
                  <q-item
                    :disable="!['whatsapp', 'telegram'].includes(ticketFocado?.channel || '')"
                    clickable
                    @click="citarMensagem(mensagem)"
                  >
                                        <q-item-section>Responder</q-item-section>
                    <q-tooltip v-if="!['whatsapp', 'telegram'].includes(ticketFocado?.channel || '')">
                      Disponível apenas para WhatsApp e Telegram
                    </q-tooltip>
                  </q-item>
                  <q-separator />
                  <q-item
                    @click=" deletarMensagem(mensagem) "
                    clickable
                    v-if=" mensagem.fromMe "
                    :disable="isDesactivatDelete(mensagem) || ticketFocado?.channel === 'messenger'"
                  >
                    <q-item-section>
                      <q-item-label>Deletar</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
            <!-- Ícones de ACK para mensagens enviadas -->
            <div v-if="mensagem.fromMe" class="absolute-bottom-right q-pr-xs q-pb-xs ack-icons-container">
              <!-- Para ACK 5 (áudio ouvido), mostrar ícone de lido + ícone de ouvido -->
              <template v-if="mensagem.ack === 5 && mensagem.mediaType === 'audio'">
                <!-- Ícone de lido (check duplo) -->
                <q-icon
                  name="mdi-check-all"
                  size="1.2em"
                  color="blue-12"
                  class="ack-read-icon"
                />
                <!-- Ícone de ouvido (fone) -->
                <q-icon
                  name="mdi-headphones"
                  size="1.0em"
                  color="blue-12"
                  class="ack-played-icon"
                />
              </template>
              <!-- Para outros ACKs, comportamento normal -->
              <q-icon
                v-else
                :name="getAckIcon(mensagem.ack)"
                size="1.2em"
                :color="getAckColor(mensagem.ack)"
              />
            </div>
            <template v-if=" mensagem.mediaType === 'audio' ">
              <WhatsAppAudioPlayer
                :audioUrl="mensagem.mediaUrl"
                :isPTT="isAudioPTT(mensagem)"
                :isSent="mensagem.fromMe"
                :audioName="getAudioFileName(mensagem)"
                :showSpeedControl="true"
                :ackStatus="mensagem.ack || 0"
              />
            </template>
            <template v-if=" mensagem.mediaType === 'vcard' ">
              <q-btn
                type="a"
                :color=" $q.dark.isActive ? '' : 'black' "
                outline
                dense
                class="q-px-sm text-center btn-rounded "
                download="vCard"
                :href=" `data:text/x-vcard;charset=utf-8;base64,${returnCardContato(mensagem.body)}` "
              >
                Download Contato
              </q-btn>
            </template>
            <template v-if=" mensagem.mediaType === 'image' ">
              <div v-viewer>
                <img
                  :src="mensagem.mediaUrl"
                  class="img-preview-chat"
                  style="cursor: pointer; max-width: 280px; max-height: 200px; border-radius: 14px;"
                  alt="imagem do chat"
                />
              </div>
            </template>
            <template v-if=" mensagem.mediaType === 'video' ">
              <video
                :src=" mensagem.mediaUrl "
                controls
                class="q-mt-md"
                style="object-fit: contain;
                  width: 330px;
                  height: 150px;
                  border-top-left-radius: 8px;
                  border-top-right-radius: 8px;
                  border-bottom-left-radius: 8px;
                  border-bottom-right-radius: 8px;
                  background: #f5f5f5;
                "
              >
              </video>
            </template>
            <template v-if=" !['audio', 'vcard', 'image', 'video'].includes(mensagem.mediaType) && mensagem.mediaUrl ">
              <div class="text-center full-width no-scroll">
                <div
                  v-if=" isPDF(mensagem.mediaUrl) "
                  class="pdf-preview-container"
                  title="Clique para abrir PDF em nova guia"
                >
                  <!-- Preview moderno do PDF -->
                  <div class="pdf-preview-card">
                    <div class="pdf-preview-header">
                      <q-icon name="mdi-file-pdf-box" size="24px" color="red-6" />
                      <div class="pdf-preview-title-section">
                        <span class="pdf-preview-title">PDF</span>
                        <span class="pdf-preview-filename">{{ mensagem.mediaName || mensagem.body || 'Documento' }}</span>
                      </div>
                    </div>
                    <div class="pdf-preview-content">
                      <div class="pdf-preview-iframe-container">
                        <iframe
                          :src="mensagem.mediaUrl"
                          class="pdf-preview-iframe"
                          frameborder="0"
                          title="Preview do PDF"
                        >
                          Seu navegador não suporta visualização de PDF.
                        </iframe>
                      </div>
                    </div>
                    <div class="pdf-preview-actions">
                      <q-btn
                        color="primary"
                        label="Visualizar"
                        @click.stop.prevent="abrirPDFNovaGuia(mensagem.mediaUrl)"
                        class="pdf-action-btn"
                      />
                      <q-btn
                        color="primary"
                        label="Abrir em nova guia"
                        @click.stop.prevent="abrirPDFNovaGuia(mensagem.mediaUrl, true)"
                        class="pdf-action-btn"
                      />
                    </div>
                  </div>
                </div>
                <q-btn
                  type="a"
                  :color=" $q.dark.isActive ? '' : 'grey-3' "
                  no-wrap
                  no-caps
                  stack
                  dense
                  class="q-mt-sm text-center text-black btn-rounded  text-grey-9 ellipsis"
                  download
                  :target=" isPDF(mensagem.mediaUrl) ? '_blank' : '' "
                  :href=" mensagem.mediaUrl "
                >
                  <q-tooltip
                    v-if=" mensagem.mediaUrl "
                    content-class="text-bold"
                  >
                    Baixar: {{ mensagem.mediaName }}
                    <span v-html="formatarMensagemWhatsapp(mensagem.body)"></span>
                  </q-tooltip>
                  <div class="row items-center q-ma-xs ">
                    <div
                      class="ellipsis col-grow q-pr-sm"
                      style="max-width: 290px"
                      v-html="formatarMensagemWhatsapp(mensagem.body || mensagem.mediaName)"
                    >
                    </div>
                    <q-icon name="mdi-download" />
                  </div>
                </q-btn>
              </div>
            </template>
            <div
              v-linkified
              v-if=" !['vcard', 'application', 'audio'].includes(mensagem.mediaType) "
              :class=" { 'q-mt-sm': mensagem.mediaType !== 'chat' } "
              class="q-message-container row items-end no-wrap"
            >
              <div v-html="formatarMensagemWhatsapp(mensagem.body)" class="emoji-text"></div>
            </div>

            <!-- Botões Interativos -->
            <template v-if="mensagem.dataPayload && mensagem.dataPayload.buttons">
              <div class="row q-gutter-sm justify-start q-mt-sm">
                <q-btn
                  v-for="(button, btnIndex) in mensagem.dataPayload.buttons"
                  :key="btnIndex"
                  dense
                  outline
                  no-caps
                  color="primary"
                  class="q-px-sm"
                  :label="button.body || button.buttonText?.displayText || 'Botão'"
                  :loading="buttonStates[`button_${mensagem.id}_${btnIndex}`]?.loading"
                  :disabled="buttonStates[`button_${mensagem.id}_${btnIndex}`]?.disabled"
                  @click="handleButtonClick(mensagem, button, btnIndex)"
                />
              </div>
            </template>

            <!-- Lista Interativa -->
            <template v-if="mensagem.dataPayload && mensagem.dataPayload.title">
              <div class="row q-gutter-sm justify-start q-mt-sm">
                <q-card class="list-message-card" flat>
                  <q-card-section class="q-pa-sm">
                    <div class="text-subtitle2 text-weight-medium">{{ mensagem.dataPayload.title }}</div>
                    <div v-if="mensagem.dataPayload.description" class="text-caption q-mt-xs">
                      {{ mensagem.dataPayload.description }}
                    </div>
                  </q-card-section>
                  <q-card-section class="q-pa-sm q-pt-none" v-if="mensagem.dataPayload.buttons">
                    <q-btn
                      v-for="(section, sectionIndex) in mensagem.dataPayload.buttons"
                      :key="sectionIndex"
                      dense
                      outline
                      no-caps
                      color="primary"
                      class="q-px-sm q-mb-xs full-width"
                      :label="section.title || 'Opção'"
                      :loading="buttonStates[`section_${mensagem.id}_${sectionIndex}`]?.loading"
                      :disabled="buttonStates[`section_${mensagem.id}_${sectionIndex}`]?.disabled"
                      @click="handleListButtonClick(mensagem, section, sectionIndex)"
                    />
                  </q-card-section>
                </q-card>
              </div>
            </template>

            <!-- Indicador de Resposta de Botão -->
            <template v-if="mensagem.dataPayload && mensagem.dataPayload.isButtonResponse">
              <div class="row q-gutter-sm justify-start q-mt-xs">
                <q-chip
                  dense
                  color="positive"
                  text-color="white"
                  icon="mdi-check-circle"
                  class="q-px-sm"
                >
                  Resposta: {{ mensagem.dataPayload.buttonText }}
                </q-chip>
              </div>
            </template>
          </div>
        </q-chat-message>
        </div>
      </div>
    </transition-group>
    <!-- Modal para visualizar PDF em tela cheia -->
    <q-dialog v-model="showPdfModal" persistent>
      <q-card class="pdf-modal-card">
        <q-card-section class="pdf-modal-header">
          <div class="text-h6">{{ currentPdfName || 'Visualizar PDF' }}</div>
          <q-btn
            icon="close"
            color="negative"
            round
            outline
            @click="showPdfModal = false"
          />
        </q-card-section>
        <q-card-section class="pdf-modal-content">
          <iframe
            v-if="currentPdfUrl"
            :src="currentPdfUrl"
            class="pdf-modal-iframe"
            frameborder="0"
            title="PDF em tela cheia"
          >
            Seu navegador não suporta visualização de PDF.
          </iframe>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { mapGetters, mapMutations } from 'vuex'
import mixinCommon from './mixinCommon'
import axios from 'axios'
import MensagemRespondida from './MensagemRespondida'
const downloadImageCors = axios.create({
  baseURL: process.env.VUE_URL_API,
  timeout: 20000,
  headers: {
    responseType: 'blob'
  }
})
import { DeletarMensagem, EnviarRespostaBotao } from 'src/service/tickets'
import { Base64 } from 'js-base64'
import WhatsAppAudioPlayer from 'src/components/WhatsAppAudioPlayer.vue'
export default {
  name: 'MensagemChat',
  mixins: [mixinCommon],
  props: {
    mensagens: {
      type: Array,
      default: () => []
    },
    ticketFocado: {
      type: Object,
      required: true
    },
    size: {
      type: [String, Number],
      default: '5'
    },
    isLineDate: {
      type: Boolean,
      default: true
    },
    isShowOptions: {
      type: Boolean,
      default: true
    },
    replyingMessage: {
      type: Object,
      default: () => { }
    }
  },
  data () {
    return {
      abrirModalImagem: false,
      urlMedia: '',
      identificarMensagem: null,
      loading: false,
      localAckIcons: {
        0: 'mdi-clock-outline',
        1: 'mdi-check',
        2: 'mdi-check-all',
        3: 'mdi-check-all',
        4: 'mdi-check-all',
        5: 'mdi-check-all' // ACK 5 base (será sobrescrito para áudios)
      },
      showPdfModal: false,
      currentPdfUrl: '',
      currentPdfName: '',
      buttonStates: {}, // Para gerenciar estado dos botões
      isAtBottom: false,
      scrollCheckTimeout: null,
      hoveredMessageId: null // Para controlar qual mensagem está com hover
    }
  },
  computed: {
    ...mapGetters({
      isMessageProcessing: 'atendimentoTicket/isMessageProcessing'
    }),
    // Obter usuário do localStorage
    usuario () {
      try {
        const usuarioStr = localStorage.getItem('usuario')
        return usuarioStr ? JSON.parse(usuarioStr) : null
      } catch (error) {
        console.error('Erro ao obter usuário do localStorage:', error)
        return null
      }
    },
    messagesByTicket () {
      return this.$store.state.atendimentoTicket.messagesByTicket || {}
    },
    unreadMessages () {
      if (!this.ticketFocado?.id) return []
      const ticketId = this.ticketFocado.id
      const messages = this.messagesByTicket[ticketId] || []
      return messages.filter(m => !m.fromMe && !m.read)
    },
    displayMessages () {
      if (!this.ticketFocado?.id) return []
      const ticketId = this.ticketFocado.id
      return this.messagesByTicket[ticketId] || []
    },
    ackIcons () {
      // Fallback para o estado local se o Vuex não estiver disponível
      return this.$store.state.chat?.ackIcons || this.localAckIcons
    },
    // Otimização: Cache das datas formatadas para evitar recálculos
    mensagensComDatas () {
      if (!this.mensagens?.length) return []

      if (!this.isLineDate) {
        // Se não deve mostrar linha de data, apenas adicionar flag false
        return this.mensagens.map((mensagem, index) => ({
          ...mensagem,
          _mostrarLinha: false,
          _mostrarHeaderUsuario: this.shouldShowUserHeader(mensagem, index)
        }))
      }

      return this.mensagens.map((mensagem, index) => {
        const dataFormatada = this.formatarData(mensagem.createdAt)
        const dataAnterior = index > 0 ? this.formatarData(this.mensagens[index - 1].createdAt) : null

        return {
          ...mensagem,
          _dataFormatada: dataFormatada,
          _mostrarLinha: index === 0 || dataFormatada !== dataAnterior,
          _mostrarHeaderUsuario: this.shouldShowUserHeader(mensagem, index)
        }
      })
    }
  },
  components: {
    MensagemRespondida,
    WhatsAppAudioPlayer
  },
  methods: {
    ...mapMutations({
      updateTicketUnreadMessages: 'UPDATE_TICKET_UNREAD_MESSAGES'
    }),
    getAckIcon (ack) {
      // Retorna o ícone apropriado para cada ACK
      const icons = this.ackIcons || this.localAckIcons
      return icons[ack] || 'mdi-clock-outline'
    },
    getAckColor (ack) {
      // Retorna a cor apropriada para cada ACK
      if (ack >= 3) {
        return 'blue-12' // Azul para lido/ouvido
      } else if (ack === 2) {
        return 'grey-7' // Cinza para entregue
      } else if (ack === 1) {
        return 'grey-5' // Cinza claro para enviado
      }
      return 'grey-4' // Cinza mais claro para pendente
    },
    isPDF (url) {
      if (!url) return false
      const split = url.split('.')
      const ext = split[split.length - 1]
      return ext === 'pdf'
    },
    isGroupLabel (mensagem) {
      try {
        return this.ticketFocado.isGroup ? mensagem.contact.name : ''
      } catch (error) {
        return ''
      }
    },
    getInitials (name) {
      if (!name) return ''
      return name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('')
    },
    getUserDisplayName (mensagem) {
      // Se a mensagem tem usuário específico, usar esse
      if (mensagem.user?.name) {
        return mensagem.user.name
      }

      // Se não tem usuário específico mas é enviada por mim, usar o usuário logado
      if (mensagem.fromMe && this.usuario) {
        // O objeto usuario do localStorage tem 'username' ao invés de 'name'
        return this.usuario.username || this.usuario.name
      }

      return null
    },
    getUserProfilePic (mensagem) {
      // Se a mensagem tem usuário específico com foto, usar essa
      if (mensagem.user?.profilePicUrl) {
        return mensagem.user.profilePicUrl
      }

      // Se não tem usuário específico mas é enviada por mim, usar a foto do usuário logado
      if (mensagem.fromMe && this.usuario?.profilePicUrl) {
        return this.usuario.profilePicUrl
      }

      return null
    },
    showAvatarFallback (event) {
      // Quando a imagem falha ao carregar, esconder ela e mostrar o fallback
      event.target.style.display = 'none'
      const fallback = event.target.nextElementSibling
      if (fallback) {
        fallback.classList.remove('avatar-fallback-hidden')
      }
    },
    hideAvatarFallback (event) {
      // Quando a imagem carrega com sucesso, esconder o fallback
      const fallback = event.target.nextElementSibling
      if (fallback) {
        fallback.classList.add('avatar-fallback-hidden')
      }
    },
    returnCardContato (str) {
      // return btoa(str)
      return Base64.encode(str)
    },
    isAudioPTT (mensagem) {
      // Verificar se é uma mensagem de voz (PTT - Push to Talk)
      // Primeiro verificar nos dados salvos
      if (mensagem.dataPayload) {
        try {
          const payload = typeof mensagem.dataPayload === 'string'
            ? JSON.parse(mensagem.dataPayload)
            : mensagem.dataPayload
          if (typeof payload.isPtt === 'boolean') {
            return payload.isPtt
          }
        } catch (e) {
          // Se falhar ao parsear, continuar com verificação manual
        }
      }

      // Fallback para verificação manual
      return mensagem.body?.includes('ptt') ||
             mensagem.mediaUrl?.includes('ptt') ||
             (mensagem.mediaName && mensagem.mediaName.includes('ptt'))
    },
    getAudioMimeType (mensagem) {
      // Tentar detectar o mimetype correto baseado na URL ou nome do arquivo
      const url = mensagem.mediaUrl || ''
      const mediaName = mensagem.mediaName || ''

      if (url.includes('.mp3') || mediaName.includes('.mp3')) {
        return 'audio/mpeg'
      } else if (url.includes('.ogg') || mediaName.includes('.ogg')) {
        return 'audio/ogg; codecs=opus'
      } else if (url.includes('.wav') || mediaName.includes('.wav')) {
        return 'audio/wav'
      } else if (url.includes('.m4a') || mediaName.includes('.m4a')) {
        return 'audio/mp4'
      }

      // Fallback baseado no tipo de áudio
      return this.isAudioPTT(mensagem) ? 'audio/ogg; codecs=opus' : 'audio/mpeg'
    },
    getAudioFileName (mensagem) {
      // Sempre usar mediaUrl como fonte primária para garantir consistência
      const url = mensagem.mediaUrl || ''
      const filename = url.split('/').pop() || ''

      if (filename) {
        // Se o filename começa com audio_ e é um timestamp, formatar melhor
        if (filename.startsWith('audio_') && filename.match(/^audio_\d+\.mp3$/)) {
          const timestamp = filename.match(/audio_(\d+)\.mp3$/)?.[1]
          if (timestamp) {
            const date = new Date(parseInt(timestamp))
            return `Áudio ${date.toLocaleString('pt-BR')}`
          }
        }
        return filename
      }

      // Fallback para mediaName se mediaUrl não estiver disponível
      if (mensagem.mediaName) {
        // Se o nome começa com audio_ e é um timestamp, formatar melhor
        if (mensagem.mediaName.startsWith('audio_') && mensagem.mediaName.match(/^audio_\d+\.mp3$/)) {
          const timestamp = mensagem.mediaName.match(/audio_(\d+)\.mp3$/)?.[1]
          if (timestamp) {
            const date = new Date(parseInt(timestamp))
            return `Áudio ${date.toLocaleString('pt-BR')}`
          }
        }
        return mensagem.mediaName
      }

      // Fallback para body se nem mediaUrl nem mediaName estiverem disponíveis
      if (mensagem.body) {
        // Se o body começa com audio_ e é um timestamp, formatar melhor
        if (mensagem.body.startsWith('audio_') && mensagem.body.match(/^audio_\d+\.mp3$/)) {
          const timestamp = mensagem.body.match(/audio_(\d+)\.mp3$/)?.[1]
          if (timestamp) {
            const date = new Date(parseInt(timestamp))
            return `Áudio ${date.toLocaleString('pt-BR')}`
          }
        }
        return mensagem.body
      }

      return this.isAudioPTT(mensagem) ? 'Mensagem de voz' : 'Arquivo de áudio'
    },
    getAudioDuration (mensagem) {
      // Obter duração do áudio se disponível
      if (mensagem.dataPayload) {
        try {
          const payload = typeof mensagem.dataPayload === 'string'
            ? JSON.parse(mensagem.dataPayload)
            : mensagem.dataPayload
          if (payload.duration && payload.duration > 0) {
            const minutes = Math.floor(payload.duration / 60)
            const seconds = payload.duration % 60
            return `${minutes}:${seconds.toString().padStart(2, '0')}`
          }
        } catch (e) {
          // Se falhar ao parsear, não mostrar duração
        }
      }
      return null
    },
    isDesactivatDelete (msg) {
      return false
    },
    async buscarImageCors (imageUrl) {
      this.loading = true
      try {
        const { data, headers } = await downloadImageCors.get(imageUrl, {
          responseType: 'blob'
        })
        const url = window.URL.createObjectURL(
          new Blob([data], { type: headers['content-type'] })
        )
        this.urlMedia = url
        this.abrirModalImagem = true
      } catch (error) {
        this.$notificarErro('Ocorreu um erro!', error)
      }
      this.loading = false
    },
    citarMensagem (mensagem) {
      this.$emit('update:replyingMessage', mensagem)

      // Emitir evento para focar o input com delay para garantir que a mensagem seja definida primeiro
      this.$nextTick(() => {
        this.$eventBus.emit('mensagem-chat:focar-input-mensagem', mensagem)
      })
    },
    showMessageOptions (messageId) {
      this.hoveredMessageId = messageId
    },
    hideMessageOptions (messageId) {
      // Só esconder se for a mesma mensagem que está sendo hovered
      // e se o menu não estiver aberto
      const menuRef = this.$refs[`menu-${messageId}`]
      const isMenuOpen = menuRef && menuRef[0] && menuRef[0].showing

      if (this.hoveredMessageId === messageId && !isMenuOpen) {
        this.hoveredMessageId = null
      }
    },
    onMenuClose (messageId) {
      // Esconder o botão quando o menu fechar
      if (this.hoveredMessageId === messageId) {
        this.hoveredMessageId = null
      }
    },
    deletarMensagem (mensagem) {
      if (this.isDesactivatDelete(mensagem)) {
        this.$notificarErro('Não foi possível apagar mensagem com mais de 5min do envio.')
      }
      const data = { ...mensagem }
      this.$q.dialog({
        title: 'Atenção!! Deseja realmente deletar a mensagem? ',
        message: 'Mensagens antigas não serão apagadas no cliente.',
        cancel: {
          label: 'Não',
          color: 'primary',
          push: true
        },
        ok: {
          label: 'Sim',
          color: 'negative',
          push: true
        },
        persistent: true
      }).onOk(() => {
        this.loading = true
        DeletarMensagem(data)
          .then(res => {
            this.loading = false
          })
          .catch(error => {
            this.loading = false
            console.error(error)
          })
      }).onCancel(() => {
      })
    },
    focarMensagem (mensagem) {
      const id = `chat-message-${mensagem.id}`
      this.identificarMensagem = id

      // Tentar múltiplas vezes com diferentes delays para garantir que funcione
      const tentarScroll = (tentativa = 0) => {
        const elem = document.getElementById(id)

        if (elem && tentativa < 5) {
          // Método 1: scrollIntoView
          elem.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          })

          // Método 2: Forçar scroll no container pai
          setTimeout(() => {
            const containers = [
              elem.closest('.q-scrollarea__container'),
              elem.closest('.chat-container'),
              document.querySelector('.q-scrollarea__container'),
              document.querySelector('.chat-container .q-scrollarea__container')
            ]

            for (const container of containers) {
              if (container && container.scrollTo) {
                const elementTop = elem.offsetTop
                const containerHeight = container.clientHeight
                const scrollPosition = Math.max(0, elementTop - (containerHeight / 2))

                container.scrollTo({
                  top: scrollPosition,
                  behavior: 'smooth'
                })
                break
              }
            }
          }, 50)

          // Vibração visual
          setTimeout(() => {
            elem.style.transform = 'scale(1.02)'
            elem.style.transition = 'transform 0.2s ease'
            setTimeout(() => {
              elem.style.transform = 'scale(1)'
            }, 200)
          }, 300)
        } else if (tentativa < 5) {
          // Tentar novamente após um delay
          setTimeout(() => tentarScroll(tentativa + 1), 100)
        } else {
          // Última tentativa: notificar que não encontrou
          this.$q.notify({
            type: 'warning',
            message: 'Mensagem citada não encontrada',
            position: 'bottom-right',
            timeout: 2000
          })
        }
      }

      // Começar as tentativas
      this.$nextTick(() => {
        tentarScroll(0)
      })

      // Limpar o destaque após 4 segundos
      setTimeout(() => {
        this.identificarMensagem = null
      }, 4000)
    },
    async markUnreadMessagesAsRead () {
      if (!this.ticketFocado || !this.ticketFocado.id) return
      if (this.loading) return

      // NÃO marcar mensagens como lidas se o ticket estiver com status 'pending'
      // Isso evita que tickets pendentes sejam automaticamente movidos para atendidos
      if (this.ticketFocado.status === 'pending') {
        return
      }

      // Verificar se realmente há mensagens não lidas
      const hasUnreadMessages = this.unreadMessages.length > 0 || this.ticketFocado.unreadMessages > 0
      if (!hasUnreadMessages) {
        return
      }

      // Verificar se já foi marcado como lido recentemente
      if (this.ticketFocado.unreadMessages === 0) {
        return
      }

      this.loading = true
      try {
        await this.$axios.post(`/api/tickets/${this.ticketFocado.id}/read`)

        // Atualiza o estado através da mutation
        this.updateTicketUnreadMessages({
          ticket: {
            ...this.ticketFocado,
            unreadMessages: 0
          }
        })
      } catch (err) {
        console.error('[markUnreadMessagesAsRead] Erro ao marcar mensagens como lidas:', err)
      } finally {
        this.loading = false
      }
    },
    getStatusIcon (ack) {
      const icons = {
        0: 'mdi-clock-outline',
        1: 'mdi-check',
        2: 'mdi-check-all',
        3: 'mdi-check-all',
        4: 'mdi-check-all'
      }
      return icons[ack] || 'mdi-clock-outline'
    },
    getStatusClass (ack) {
      const classes = {
        0: 'sent',
        1: 'delivered',
        2: 'delivered',
        3: 'read',
        4: 'read'
      }
      return classes[ack] || 'sent'
    },
    abrirPDFNovaGuia (url, isNewTab = false) {
      // Verificar se a URL é válida
      if (!url || typeof url !== 'string') {
        console.warn('URL inválida fornecida para abrirPDFNovaGuia:', url)
        return
      }

      if (isNewTab) {
        window.open(url, '_blank')
        return // Impede que o modal seja aberto
      }
      this.currentPdfUrl = url
      this.currentPdfName = this.mensagem?.mediaName || this.mensagem?.body || 'Documento'
      this.showPdfModal = true
    },
    async handleButtonClick (mensagem, button, btnIndex) {
      try {
        // Adicionar loading ao botão usando uma propriedade local
        const buttonKey = `button_${mensagem.id}_${btnIndex}`
        this.$set(this.buttonStates, buttonKey, { loading: true })

        const buttonText = button.body || button.buttonText?.displayText || 'Botão'

        // Enviar resposta do botão
        await EnviarRespostaBotao({
          ticketId: this.ticketFocado.id,
          buttonId: button.id,
          buttonText: buttonText,
          messageId: mensagem.id
        })

        // Marcar botões como desabilitados usando propriedades locais
        if (mensagem.dataPayload && mensagem.dataPayload.buttons) {
          mensagem.dataPayload.buttons.forEach((btn, index) => {
            const btnKey = `button_${mensagem.id}_${index}`
            this.$set(this.buttonStates, btnKey, { disabled: true, loading: false })
          })
        }

        this.$q.notify({
          type: 'positive',
          message: `Resposta enviada: ${buttonText}`,
          position: 'bottom-right'
        })
      } catch (error) {
        console.error('Erro ao enviar resposta do botão:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao enviar resposta do botão',
          position: 'bottom-right'
        })
      } finally {
        // Remover loading do botão
        const buttonKey = `button_${mensagem.id}_${btnIndex}`
        this.$set(this.buttonStates, buttonKey, { loading: false })
      }
    },
    async handleListButtonClick (mensagem, section, sectionIndex) {
      try {
        // Adicionar loading ao botão da lista usando uma propriedade local
        const sectionKey = `section_${mensagem.id}_${sectionIndex}`
        this.$set(this.buttonStates, sectionKey, { loading: true })

        const buttonText = section.title || 'Opção'

        // Enviar resposta do botão da lista
        await EnviarRespostaBotao({
          ticketId: this.ticketFocado.id,
          buttonId: section.id || `section_${sectionIndex}`,
          buttonText: buttonText,
          messageId: mensagem.id
        })

        // Marcar botões da lista como desabilitados usando propriedades locais
        if (mensagem.dataPayload && mensagem.dataPayload.buttons) {
          mensagem.dataPayload.buttons.forEach((btn, index) => {
            const btnKey = `section_${mensagem.id}_${index}`
            this.$set(this.buttonStates, btnKey, { disabled: true, loading: false })
          })
        }

        this.$q.notify({
          type: 'positive',
          message: `Resposta enviada: ${buttonText}`,
          position: 'bottom-right'
        })
      } catch (error) {
        console.error('Erro ao enviar resposta da lista:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Erro ao enviar resposta da lista',
          position: 'bottom-right'
        })
      } finally {
        // Remover loading do botão da lista
        const sectionKey = `section_${mensagem.id}_${sectionIndex}`
        this.$set(this.buttonStates, sectionKey, { loading: false })
      }
    },
    setupScrollListener () {
      // Configurar listener para detectar quando o usuário está no final da conversa
      this.$nextTick(() => {
        // Tentar múltiplos seletores para encontrar o container de scroll
        const scrollContainers = [
          '.q-scrollarea__container',
          '.scroll-y .q-scrollarea__container',
          '[ref="scrollContainer"] .q-scrollarea__container',
          '.chat-container .q-scrollarea__container'
        ]

        let scrollContainer = null
        for (const selector of scrollContainers) {
          scrollContainer = document.querySelector(selector)
          if (scrollContainer) break
        }

        if (scrollContainer) {
          // Remover listener anterior se existir
          scrollContainer.removeEventListener('scroll', this.checkScrollPosition)

          // Adicionar novo listener
          scrollContainer.addEventListener('scroll', this.checkScrollPosition, { passive: true })

          // Verificar posição inicial após um delay maior
          setTimeout(() => {
            this.checkScrollPosition()
          }, 1000)
        }
      })
    },
    checkScrollPosition () {
      // Verificar se o usuário está no final da conversa
      const scrollContainer = document.querySelector('.q-scrollarea__container') ||
                             document.querySelector('.scroll-y .q-scrollarea__container')

      if (!scrollContainer) {
        return
      }

      const { scrollTop, scrollHeight, clientHeight } = scrollContainer
      const threshold = 50 // Reduzir threshold para 50px de tolerância

      // Usuário está no final se a distância até o final for menor que o threshold
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const isAtBottom = distanceFromBottom <= threshold

      if (isAtBottom && !this.isAtBottom) {
        this.isAtBottom = true
        // Marcar mensagens como lidas quando chegar ao final
        this.markUnreadMessagesAsReadOnScroll()
      } else if (!isAtBottom && this.isAtBottom) {
        this.isAtBottom = false
      }
    },
    markUnreadMessagesAsReadOnScroll () {
      // Só marcar como lidas se há mensagens não lidas
      if (this.ticketFocado?.unreadMessages > 0) {
        // Debounce reduzido para 500ms para ser mais responsivo
        if (this.scrollCheckTimeout) {
          clearTimeout(this.scrollCheckTimeout)
        }

        this.scrollCheckTimeout = setTimeout(() => {
          this.markUnreadMessagesAsRead()
        }, 500) // Reduzir tempo para 500ms
      }
    },
    shouldShowUserHeader (mensagem, index) {
      // Só mostrar header para mensagens enviadas por mim
      if (!mensagem.fromMe) {
        return false
      }

      // Se não tem nome do usuário para mostrar, não mostrar header
      if (!this.getUserDisplayName(mensagem)) {
        return false
      }

      // Para mensagens enviadas, sempre mostrar header para primeira mensagem
      if (index === 0) {
        return true
      }

      const mensagemAnterior = this.mensagens[index - 1]

      // Se a mensagem anterior não foi enviada por mim, mostrar header
      if (!mensagemAnterior.fromMe) {
        return true
      }

      // Se a mensagem anterior foi enviada por outro usuário, mostrar header
      const usuarioAtual = this.getUserDisplayName(mensagem)
      const usuarioAnterior = this.getUserDisplayName(mensagemAnterior)

      if (usuarioAtual !== usuarioAnterior) {
        return true
      }

      // Para mensagens enviadas, mostrar header com quebra de tempo menor (2 minutos)
      const tempoAtual = new Date(mensagem.createdAt)
      const tempoAnterior = new Date(mensagemAnterior.createdAt)
      const diferencaMinutos = (tempoAtual - tempoAnterior) / (1000 * 60)

      // Se passou mais de 2 minutos, mostrar header novamente
      if (diferencaMinutos > 2) {
        return true
      }

      // Caso contrário, não mostrar (mensagens consecutivas do mesmo usuário)
      return false
    },
    handleDoubleClick (mensagem) {
      // Verificar se a mensagem não está deletada e se o canal suporta resposta
      if (mensagem.isDeleted) {
        return
      }

      if (!['whatsapp', 'telegram'].includes(this.ticketFocado?.channel || '')) {
        this.$q.notify({
          type: 'warning',
          message: 'Responder mensagens está disponível apenas para WhatsApp e Telegram',
          position: 'bottom-right'
        })
        return
      }

      // Adicionar feedback visual
      const messageElement = document.getElementById(`chat-message-${mensagem.id}`)
      if (messageElement) {
        messageElement.classList.add('double-click-feedback')
        setTimeout(() => {
          messageElement.classList.remove('double-click-feedback')
        }, 300)
      }

      // Responder à mensagem (mesmo comportamento do menu)
      this.citarMensagem(mensagem)
    }
  },
  watch: {
    ticketFocado: {
      handler (newTicket, oldTicket) {
        // Não marcar mensagens como lidas automaticamente quando ticket muda
        // Deixar que o usuário role até o final para marcar como lidas
        if (newTicket && newTicket.id !== oldTicket?.id) {
          this.isAtBottom = false
          // Reconfigurar listener quando ticket muda
          this.$nextTick(() => {
            this.setupScrollListener()
          })
        }
      },
      immediate: false
    },
    // Watch para mensagens para reconfigurar listener quando novas mensagens chegarem
    mensagens: {
      handler () {
        // Aguardar renderização das novas mensagens e verificar posição
        this.$nextTick(() => {
          setTimeout(() => {
            this.checkScrollPosition()
          }, 300)
        })
      },
      deep: true
    }
  },
  mounted () {
    this.scrollToBottom()
    // Não marcar mensagens como lidas automaticamente ao montar
    // Deixar que o usuário role até o final
    this.setupScrollListener()
  },
  destroyed () {
    // Limpar listeners e timeouts
    const scrollContainer = document.querySelector('.q-scrollarea__container')
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', this.checkScrollPosition)
    }
    if (this.scrollCheckTimeout) {
      clearTimeout(this.scrollCheckTimeout)
    }
  }
}
</script>

<style lang="scss">
.frame-pdf {
  overflow: hidden;
}

.pdf-preview-container {
  cursor: pointer;
  display: inline-block;
  position: relative;
  margin-bottom: 8px;

  &:hover {
    .pdf-preview-card {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }

    .pdf-preview-footer {
      background: #1976d2;

      .pdf-preview-action {
        color: white;
      }

      .q-icon {
        color: white !important;
      }
    }
  }
}

.pdf-preview-card {
  width: 280px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.pdf-preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.pdf-preview-title-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pdf-preview-title {
  font-weight: 600;
  color: #495057;
  font-size: 14px;
}

.pdf-preview-filename {
  font-size: 11px;
  color: #6c757d;
  font-weight: 400;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdf-preview-content {
  padding: 0;
  background: #f8f9fa;
  min-height: 200px;
  max-height: 300px;
  overflow: hidden;
  border-radius: 0;
}

.pdf-preview-iframe-container {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
  border-radius: 0;
}

.pdf-preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
}

.pdf-preview-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.pdf-preview-container:hover .pdf-preview-overlay {
  opacity: 1;
}

.pdf-overlay-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
}

.pdf-overlay-btn {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.9) !important;
  border: 2px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;

  &:hover {
    transform: scale(1.1);
    background: rgba(255, 255, 255, 1) !important;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }
}

.pdf-preview-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.pdf-preview-action {
  font-weight: 600;
  color: #1976d2;
  font-size: 13px;
  transition: color 0.3s ease;
}

/* Dark mode support */
.body--dark .pdf-preview-card {
  background: #2d3748;
  border-color: rgba(255, 255, 255, 0.1);
}

.body--dark .pdf-preview-header {
  background: #4a5568;
}

.body--dark .pdf-preview-title {
  color: #e2e8f0;
}

.body--dark .pdf-preview-content {
  background: #1a202c;
}

.body--dark .pdf-page-sheet {
  background: #2d3748;
  border-color: rgba(255, 255, 255, 0.1);
}

.body--dark .pdf-page-text {
  color: #a0aec0;
}

.body--dark .pdf-preview-footer {
  background: #1a202c;
  border-top-color: rgba(255, 255, 255, 0.1);
}

.body--dark .pdf-preview-action {
  color: #63b3ed;
}

.body--dark .pdf-preview-title {
  color: #e2e8f0;
}

.body--dark .pdf-preview-filename {
  color: #a0aec0;
}

.checkbox-encaminhar-right {
  right: -35px;
  z-index: 99999;
}

.checkbox-encaminhar-left {
  left: -35px;
  z-index: 99999;
}

/* Modal do PDF */
.pdf-modal-card {
  background: white;
  border-radius: 12px;
  width: 90vw;
  max-width: 1200px;
  height: 80vh;
  max-height: 800px;
  overflow: hidden;
}

.pdf-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding: 16px 24px;
  border-radius: 12px 12px 0 0;
}

.pdf-modal-content {
  padding: 0;
  height: calc(100% - 80px);
  overflow: hidden;
}

.pdf-modal-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
  border-radius: 0 0 12px 12px;
}

/* Dark mode para o modal */
.body--dark .pdf-modal-card {
  background: #1a202c;
}

.body--dark .pdf-modal-header {
  background: #2d3748;
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.body--dark .pdf-modal-iframe {
  background: #1a202c;
}

/* Ações do PDF no card */
.pdf-preview-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  padding-bottom: 16px;
}

/* Estilos removidos - agora usando WhatsAppAudioPlayer */

.pdf-action-btn {
  min-width: 70px;
  font-weight: 500;
  letter-spacing: 0.05px;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  font-size: 0.60rem;
  padding: 2px 8px;
  height: 24px;
  transition: all 0.2s cubic-bezier(.4,0,.2,1);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1976d2;
  color: #fff !important;
  border: none;
  line-height: 1;
}

.pdf-action-btn.q-btn--outline {
  background: #e0e0e0;
  color: #1976d2 !important;
  border: 1px solid #1976d2;
}

.pdf-action-btn:hover, .pdf-action-btn:focus {
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.10);
  background: #1565c0;
  color: #fff !important;
  transform: translateY(-1px) scale(1.02);
}

.pdf-action-btn:active {
  box-shadow: 0 1px 4px rgba(25, 118, 210, 0.08);
  transform: scale(0.98);
}

.pdf-action-btn[disabled], .pdf-action-btn.q-btn--disabled {
  opacity: 0.6;
  background: #e0e0e0 !important;
  color: #bdbdbd !important;
  box-shadow: none;
  cursor: not-allowed;
}

/* Remover overlay antigo */
.pdf-preview-overlay, .pdf-overlay-buttons, .pdf-overlay-btn { display: none !important; }

/* Estilos para botões interativos */
.list-message-card {
  background: #f8f9fa;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  max-width: 300px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.list-message-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

/* Dark mode para listas */
.body--dark .list-message-card {
  background: #2d3748;
  border-color: rgba(255, 255, 255, 0.1);
}

.body--dark .list-message-card .text-subtitle2 {
  color: #e2e8f0;
}

.body--dark .list-message-card .text-caption {
  color: #a0aec0;
}

/* Botões interativos */
.q-btn[disable] {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Responsividade para botões */
@media (max-width: 600px) {
  .list-message-card {
    max-width: 250px;
  }

  .q-btn.q-px-sm {
    font-size: 0.75rem;
    padding: 4px 8px;
  }
}

/* Player de áudio agora integrado com design do WhatsApp */

/* Container integrado para avatar, nome e mensagem */
.user-message-container {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
  justify-content: flex-end;
  padding-right: 8px;
  flex-direction: row;

  .user-info-column {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex: 1;

    .q-chat-message {
      margin: 0;
      width: 100%;
      max-width: none;

      /* Garantir que a mensagem tenha o mesmo alinhamento das agrupadas */
      .q-message-text {
        margin-right: 0;
      }
    }
  }

  .user-avatar-external {
    flex-shrink: 0;
    order: 2; /* Avatar após a mensagem */
    width: 36px;
    height: 36px;
  }
}

/* Layout externo para avatar e nome do usuário (compatibilidade) */
.user-header-external {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  justify-content: flex-end;
  padding-right: 8px;
  flex-direction: row;
}

/* Espaçamento reduzido para mensagens agrupadas */
.mensagem-agrupada {
  margin-top: 2px !important;
  margin-bottom: 2px !important;
}

/* Ajustar espaçamento padrão das mensagens enviadas */
.q-chat-message--sent {
  margin-bottom: 8px;
}

/* Wrapper para todas as mensagens */
.message-wrapper {
  display: block;
  margin-bottom: 8px;
}

/* Wrapper específico para mensagens enviadas - alinhamento com avatar */
.sent-message-wrapper {
  padding-right: 56px; /* Espaço do avatar (36px) + gap (12px) + padding (8px) */

  .q-chat-message {
    margin: 0;
  }
}

/* Para mensagens agrupadas, reduzir espaçamento */
.mensagem-agrupada.q-chat-message--sent {
  margin-bottom: 2px;
}

.user-avatar-external {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.user-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.user-avatar-external:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}

.user-avatar-fallback-external {
  background: #9e9e9e;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
}

.user-avatar-fallback-external::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255,255,255,0.1);
  border-radius: 50%;
  pointer-events: none;
}

.avatar-fallback-hidden {
  display: none !important;
}

/* user-info-column está definido dentro de .user-message-container */

.user-name-external {
  font-size: 12px;
  font-weight: 500;
  color: var(--q-color-grey-8, #424242);
  text-transform: capitalize;
  margin-bottom: 4px;
  text-align: right;
  width: 100%;
}

/* Dark mode para container de mensagem e header do usuário */
.body--dark .user-name-external {
  color: var(--q-color-grey-3, #e0e0e0);
}

.body--dark .user-avatar-external {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.body--dark .user-avatar-external:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}

.body--dark .user-avatar-fallback-external {
  background: #616161;
}

.body--dark .user-avatar-fallback-external::before {
  background: rgba(255,255,255,0.2);
}

/* Dark mode para container integrado */
.body--dark .user-message-container {
  .user-name-external {
    color: var(--q-color-grey-3, #e0e0e0);
  }
}

/* Estilos para os ícones de ACK */
.ack-icons-container {
  display: flex;
  align-items: center;
  gap: 2px;

  .ack-read-icon {
    opacity: 1;
  }

  .ack-played-icon {
    margin-left: -2px;
    opacity: 0.9;
  }
}

/* Animação para o ícone de ouvido */
.ack-played-icon {
  animation: fadeInScale 0.3s ease-in-out;
}

@keyframes fadeInScale {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 0.9;
    transform: scale(1);
  }
}

/* Estilo para esconder botão de opções por padrão */
.mensagem-hover-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
}

/* Mostrar botão quando a mensagem tem a classe hover ativa */
.mensagem-hover-active .mensagem-hover-btn {
  opacity: 1;
}

/* Garantir que o botão apareça quando o menu está aberto */
.mensagem-hover-btn.q-btn--menu-open {
  opacity: 1;
}

/* Garantir que o botão de opções apareça por cima de mídias e áudios */
.mostar-btn-opcoes-chat {
  z-index: 1000 !important;
  position: absolute !important;
}

/* Z-index específico para aparecer por cima de elementos de mídia */
.mensagem-hover-btn {
  z-index: 1000 !important;
}

/* Garantir que o botão de opções apareça por cima de mídias e áudios */
.mostar-btn-opcoes-chat {
  z-index: 1000 !important;
  position: absolute !important;
}

/* Específico para mensagens com mídia */
.q-chat-message .mostar-btn-opcoes-chat {
  z-index: 999999 !important;
}

/* Garantir que funcione com áudio players e outros componentes */
.q-message-container .mensagem-hover-btn {
  z-index: 999999 !important;
  position: absolute !important;
}

/* Forçar posicionamento correto em qualquer contexto */
.absolute-top-right.mensagem-hover-btn {
  z-index: 999999 !important;
  position: absolute !important;
  top: 8px !important;
  right: 8px !important;
}

/* Específico para elementos com mídia para garantir que o botão sempre apareça */
.q-chat-message:has(audio),
.q-chat-message:has(video),
.q-chat-message:has(img),
.q-chat-message:has(iframe) {
  .mensagem-hover-btn {
    z-index: 999999 !important;
    position: absolute !important;
  }
}

/* Forçar posicionamento correto em qualquer contexto */
.absolute-top-right.mensagem-hover-btn {
  z-index: 999999 !important;
  position: absolute !important;
  top: 8px !important;
  right: 8px !important;
}

/* Específico para elementos com mídia para garantir que o botão sempre apareça */
.q-chat-message:has(audio),
.q-chat-message:has(video),
.q-chat-message:has(img),
.q-chat-message:has(iframe) {
  .mensagem-hover-btn {
    z-index: 999999 !important;
    position: absolute !important;
  }
}

/* Estilo para destacar mensagem focada/citada */
.pulseIdentications {
  animation: pulseHighlight 2s ease-in-out;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: -8px;
    left: -8px;
    right: -8px;
    bottom: -8px;
    background: rgba(63, 81, 181, 0.2);
    border-radius: 12px;
    pointer-events: none;
    z-index: -1;
    animation: pulseGlow 2s ease-in-out;
  }

  .q-message-text {
    transform: scale(1.02);
    transition: all 0.3s ease;
  }
}

/* Animações para destaque da mensagem */
@keyframes pulseHighlight {
  0% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.03);
  }
  50% {
    transform: scale(1.02);
  }
  75% {
    transform: scale(1.03);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes pulseGlow {
  0% {
    opacity: 0;
    transform: scale(0.95);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
  100% {
    opacity: 0;
    transform: scale(1);
  }
}

/* Linha horizontal com data - Otimizada */
.hr-text {
  position: relative;
  border: 0;
  text-align: center;
  height: 1.5em;
  margin: 16px 0;

  /* Linha horizontal */
  &::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: #818078;
  }

  /* Badge da data */
  &::after {
    content: attr(data-content);
    display: inline-block;
    padding: 4px 12px;
    font-size: 13px;
    font-weight: 500;
    background: var(--q-color-grey-1, #f5f5f5);
    color: var(--q-color-grey-8, #424242);
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    position: relative;
    z-index: 1;
  }
}

/* Dark mode otimizado */
.body--dark .hr-text::after {
  background: var(--q-color-grey-9, #2d2d2d);
  color: var(--q-color-grey-3, #e0e0e0);
}

/* Estilos para duplo clique nas mensagens */
.q-chat-message {
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: text; /* Permitir seleção de texto */

  /* Indicador visual de que é clicável */
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  /* Efeito de duplo clique */
  &:active {
    transform: scale(0.98);
    transition: transform 0.1s ease;
  }

  /* Feedback visual para duplo clique */
  &.double-click-feedback {
    animation: doubleClickPulse 0.3s ease-out;
  }
}

/* Animação para feedback de duplo clique */
@keyframes doubleClickPulse {
  0% {
    transform: scale(1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  50% {
    transform: scale(0.95);
    box-shadow: 0 4px 16px rgba(25, 118, 210, 0.3);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

/* Dark mode para duplo clique */
.body--dark .q-chat-message {
  &:hover {
    box-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);
  }

  &.double-click-feedback {
    animation: doubleClickPulseDark 0.3s ease-out;
  }
}

@keyframes doubleClickPulseDark {
  0% {
    transform: scale(1);
    box-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);
  }
  50% {
    transform: scale(0.95);
    box-shadow: 0 4px 16px rgba(144, 202, 249, 0.4);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);
  }
}

/* Desabilitar duplo clique para mensagens deletadas */
.q-message-text--deleted {
  cursor: default !important;

  &:hover {
    transform: none !important;
    box-shadow: none !important;
  }

  &:active {
    transform: none !important;
  }
}

.emoji-text {
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', 'EmojiSymbols', 'EmojiOne Mozilla', 'Twemoji Mozilla', 'Segoe UI', sans-serif !important;
  font-size: 1.2em;
}

</style>
