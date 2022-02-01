import 'dotenv/config';

import fs from 'fs';
import path from 'path';
import Discord, { TextChannel } from 'discord.js';
import { ethers } from "ethers";
import { OpenSeaClient } from './opensea';

const openseaClient = new OpenSeaClient();


function readDB() {
    let data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'sales.json')).toString());
    return data;
}

function updateDB(newData) {
    let origData = readDB();
    let merged = {...origData, ...newData};
    fs.writeFileSync(path.resolve(__dirname, 'sales.json'), JSON.stringify(merged));
}


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

const buildMessage = (data: any) => {
    let timeToSell = (new Date(`${data.created_date}Z`).getTime() - new Date(`${data.listing_time}Z`).getTime())/1000/60;
    let msg = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setURL(data.asset.permalink)
        .setTitle(`${data.asset.name} - ${(data.total_price / 1000000000000000000).toFixed(3)} ${data.payment_token.symbol}`)
        .setThumbnail(data.asset.image_thumbnail_url)
        .setDescription(`from ${data.seller.user?.username} to ${data.asset.owner?.user?.username} \n(list to sold ${timeToSell.toFixed(3)} mins)`)
        .setFooter(`${new Date(`${data.created_date}Z`).toString()}`)
        ;
    console.log(msg);
    return msg;
};

/* TODO:
 * 1. Handle bundle
 * 2. Handle auction in sales
*/


async function getEvents() {
    const db = readDB();
    return Promise.all(
        process.env.LIST_COLLECTION_SLUG.split(';').map(async (slug: string) => {
            console.log(slug);
            let lastCreated = db[slug];
            let lastCreatedTs = 0;
            if (slug in db) {
                lastCreatedTs = Math.floor(new Date(`${lastCreated}Z`).getTime() / 1000);
            }
            
            const lists = await openseaClient.events(slug, "successful", lastCreatedTs);
            if (lists.length <= 0) {
                console.log("No updates.");
                return;
            }
            const first = lists[0];
            updateDB({[slug]: first.created_date});
            return Promise.all(
                lists.reverse().map(async d => {
                    try {
                        // already processed
                        if (d.created_date <= lastCreated) {
                            return;
                        }
                        const message = buildMessage(d);
                        return message;
                        // return Promise.all(
                        //     process.env.SALE_DISCORD_CHANNEL_ID.split(';').map(async (channel: string) => {
                        //         return await (await discordSetup(channel)).send(message)
                        //     })
                        // );
                    } catch (e) {
                        console.error(e);
                        console.error(d);
                    }
                })
            );
        })
    ).then((messages) => {
        return Promise.all(
            process.env.LIST_DISCORD_CHANNEL_ID.split(';').map(async (channel: string) => {
                const c = await discordSetup(channel);
                return Promise.all(
                    messages.map(async (message) => {
                        return await c.send(message)
                    })
                );
            })
        );

    });
}

getEvents()
  .then((res) => {
    process.exit(0)
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
