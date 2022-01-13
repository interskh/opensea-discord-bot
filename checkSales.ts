import 'dotenv/config';
import Discord, { TextChannel } from 'discord.js';
import fetch from 'node-fetch';
import { ethers } from "ethers";

const OPENSEA_SHARED_STOREFRONT_ADDRESS = '0x495f947276749Ce646f68AC8c248420045cb7b5e';

const discordBot = new Discord.Client();
const  discordSetup = async (channel: string): Promise<TextChannel> => {
  const channelID = channel
  return new Promise<TextChannel>((resolve, reject) => {
    if (!process.env['DISCORD_BOT_TOKEN']) reject('DISCORD_BOT_TOKEN not set')
    discordBot.login(process.env.DISCORD_BOT_TOKEN);
    discordBot.on('ready', async () => {
      const channel = await discordBot.channels.fetch(channelID!);
      resolve(channel as TextChannel);
    });
  })
}

const buildMessage = (resps: any) => {
    var msg = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle("NFT Prices");

    for (const resp of resps) {
        var slug = resp[0];
        var data = JSON.parse(resp[1]);
        try {
            msg.addFields(
                {name: slug + ' floor', value: data.stats.floor_price + ethers.constants.EtherSymbol, inline: true},
                {name: slug + ' sales', value: data.stats.one_day_sales, inline: true},
                {name: slug + ' 1d price', value: data.stats.one_day_average_price.toFixed(3) + ethers.constants.EtherSymbol, inline: true},
                //{name: slug + ' 7d price', value: data.stats.seven_day_average_price.toFixed(3) + ethers.constants.EtherSymbol, inline: true},
            )
        } catch (e) {}
    }
    msg.addFields(
        { name: 'Timestamp', value: new Date() },
    );
    return msg;
};

async function floorPrice() {
    let openSeaFetch = {}
    if (process.env.OPENSEA_TOKEN) {
        openSeaFetch['headers'] = {'X-API-KEY': process.env.OPENSEA_TOKEN}
    }

    return Promise.all(
        process.env.COLLECTION_SLUG.split(';').map(async (slug: string) => {
            let responseText = "";
            try {
                const openSeaResponseObj = await fetch(
                  `https://api.opensea.io/api/v1/collection/${slug}/stats`, openSeaFetch
                );
                let responseText = await openSeaResponseObj.text();
                //return {"slug": slug, "data": JSON.parse(responseText)};
                return [slug, responseText];
            } catch (e) {
                const payload = responseText || "";
                if (payload.includes("cloudflare") && payload.includes("1020")) {
                  throw new Error("You are being rate-limited by OpenSea. Please retrieve an OpenSea API token here: https://docs.opensea.io/reference/request-an-api-key")
                }
            throw e;
          }
        })
    ).then(responses => {
        console.log(responses);
        const message = buildMessage(responses);
        return Promise.all(
          process.env.DISCORD_CHANNEL_ID.split(';').map(async (channel: string) => {
            return await (await discordSetup(channel)).send(message)
          })
        );
    })
}

floorPrice()
  .then((res) => {
    process.exit(0)
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
