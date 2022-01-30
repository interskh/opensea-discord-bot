import 'dotenv/config';
import Discord, { TextChannel } from 'discord.js';
import fetch from 'node-fetch';
import { ethers } from "ethers";

import { OpenSeaClient } from './opensea';

const OPENSEA_SHARED_STOREFRONT_ADDRESS = '0x495f947276749Ce646f68AC8c248420045cb7b5e';

const openseaClient = new OpenSeaClient();

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
        var stats = resp[1];
        try {
            var price_change_ratio = stats.one_day_average_price / stats.seven_day_average_price - 1;
            msg.addFields(
                {name: slug, value: `${stats.floor_price}${ethers.constants.EtherSymbol} | ${stats.one_day_average_price.toFixed(3)}${ethers.constants.EtherSymbol} | ${stats.seven_day_average_price.toFixed(3)}${ethers.constants.EtherSymbol} | ${stats.thirty_day_average_price.toFixed(3)}${ethers.constants.EtherSymbol} | ${(price_change_ratio<0?"":"+")}${(price_change_ratio*100).toFixed(2)}% | ${stats.one_day_sales} | ${(stats.one_day_change<0?"":"+")}${(stats.one_day_change*100).toFixed(2)}%`},
            )
        } catch (e) {}
    }
    //msg.addFields(
    //    { name: 'Timestamp', value: new Date() },
    //);
    return msg;
};

async function floorPrice() {
    return Promise.all(
        process.env.COLLECTION_SLUG.split(';').map(async (slug: string) => {
            return [slug, await openseaClient.stats(slug)];
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
