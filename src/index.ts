import { MessageType, WAConnection } from "@adiwajshing/baileys";
import axios from "axios";
import imageToBase64 from "image-to-base64";
import fs from "fs";
import moment from "moment";
import { exec } from "child_process";
import ffmpeg from "fluent-ffmpeg";

// eslint-disable-next-line import/no-unresolved
import { pixabayKey, info } from "./config/config";

const conn = new WAConnection();

conn.on("chats-received", async ({ hasNewChats }) => {
  console.log(`You have ${conn.chats.length} chats, new chats avaliable: ${hasNewChats}`);
});

conn.on("credentials-updated", () => {
  console.log("credentials updated!");
  const authInfo = conn.base64EncodedAuthInfo();
  fs.writeFileSync("./auth_info.json", JSON.stringify(authInfo, null, "\t"));
});

// eslint-disable-next-line no-unused-expressions
fs.existsSync("./auth_info.json") && conn.loadAuthInfo("./auth_info.json");

conn.connect();

conn.on("chat-update", async (chat) => {
  try {
    if (!chat.hasNewMessage) return;

    const m = chat.messages.all()[0];

    const { imageMessage } = m.message;
    const { videoMessage } = m.message;
    const messageContent = m.message.conversation;
    const id = m.key.remoteJid;
    const contentKey = m.message;
    console.log(`${id}: ${messageContent}`);
    const jam = moment().format("HH:mm");

    const messageType = Object.keys(contentKey)[0];

    const args = messageContent.slice(0).split(/ +/);
    const command = args.shift()?.toLowerCase();

    // Comandos

    console.log(`
    messageType:
    ${messageType}
    `);

    if (command === "!info") {
      conn.sendMessage(id, info, MessageType.text);
    }

    if (command === "!hello") {
      const messageReturn = "hello there!";
      conn.sendMessage(id, messageReturn, MessageType.text);
    }

    if (command === "!image") {
      const text = messageContent.toLowerCase();
      const search = text.replace("!image", "");
      const URL = `https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(search)}`;
      console.log(URL);

      axios.get(URL).then((result) => {
        let { totalHits } = result.data;
        console.log(totalHits);

        if (totalHits === 0) {
          conn.sendMessage(id, "Imagem não encontrada.", MessageType.text);
          return;
        }

        if (totalHits > 20) {
          totalHits = 20;
        }

        const randomHit = Math.floor(Math.random() * totalHits) - 0;

        const b = JSON.parse(JSON.stringify(result.data.hits[randomHit].largeImageURL));
        console.log(b);
        imageToBase64(b)
          .then((response) => {
            const buf = Buffer.from(response, "base64");

            conn.sendMessage(id, buf, MessageType.image);
          })
          .catch((error) => {
            console.log(error);
          });
      });
    }

    if (command === "!biblia") {
      try {
        const response = await axios.get("https://www.abibliadigital.com.br/api/verses/nvi/random");
        const { name } = response.data.book;
        const { chapter } = response.data;
        const { number } = response.data;
        const { text } = response.data;
        console.log(`${name} ${chapter}:${number}`);
        console.log(text);

        const result = `*${name} ${chapter}:${number}*\n\n _${text}_`;

        conn.sendMessage(id, result, MessageType.text);
      } catch (err) {
        conn.sendMessage(id, "Ocorreu um erro inesperado.", MessageType.text);
        console.log(`erro: ${err}`);
      }
    }

    if (messageType === MessageType.image) {
      try {
        const caption = imageMessage.caption.toLowerCase();

        console.log(`
        caption:
        ${caption}
        `);

        if (caption === "!sticker") {
          const stiker = await conn.downloadAndSaveMediaMessage(m, "imageToSticker");
          console.log(stiker);

          exec(`cwebp -q 50 ${stiker} -o temp/${jam}.webp`, (error: any, stdout: any, stderr: any) => {
            if (error) {
              console.log(`stderr:${stderr}`);
            } else {
              const sticker = fs.readFileSync(`temp/${jam}.webp`);

              conn.sendMessage(id, sticker, MessageType.sticker);
            }
          });
        }
      } catch (err) {
        conn.sendMessage(id, "Não foi possível executar o comando. Tente novamente.", MessageType.text);
        console.log(`erro no !sticker: ${err}`);
      }
    }

    if (messageType === MessageType.video) {
      try {
        const caption = videoMessage.caption.toLowerCase();

        console.log("caption: ");
        console.log(caption);

        if (caption === "!sticker") {
          const video = await conn.downloadAndSaveMediaMessage(m, "videoToSticker");
          console.log(video);

          const videoConverted = await new Promise((resolve) => {
            ffmpeg(video)
              .on("start", (cmd) => console.log(`Started ${cmd}`))
              .inputFormat("mp4")
              .videoCodec("libwebp")
              .setStartTime(0)
              .setSize("512x512")
              .toFormat("webp")
              .videoFilters("crop=w='min(min(iw,ih),500)':h='min(min(iw,ih),500)',scale=500:500,setsar=1")
              .on("end", () => resolve(true))
              .saveToFile(`temp/${jam}.webp`);
          });

          if (!videoConverted) {
            console.log("Erro ao converter video.");
            return;
          }

          const sticker = fs.readFileSync(`temp/${jam}.webp`);

          await conn.sendMessage(id, sticker, MessageType.sticker);
        }
      } catch (err) {
        conn.sendMessage(id, "Não foi possível executar o comando. Tente novamente.", MessageType.text);
        console.log(`erro no !sticker: ${err}`);
      }
    }
  } catch (err) {
    console.log(`ocorreu um erro: ${err}`);
  }
});
