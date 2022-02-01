import 'dotenv/config';

import fs from 'fs';
import path from 'path';
import Discord, { TextChannel } from 'discord.js';
import { ethers } from "ethers";
import { OpenSeaClient } from './opensea';

const openseaClient = new OpenSeaClient();


function readDB() {
    let data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'db.json')).toString());
    return data;
}

function updateDB(newData) {
    let origData = readDB();
    let merged = {...origData, ...newData};
    fs.writeFileSync(path.resolve(__dirname, 'db.json'), JSON.stringify(merged));
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
    var msg = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setURL(data.asset.permalink)
        .setTitle(`${data.asset.name} - ${(data.starting_price / 1000000000000000000).toFixed(3)} ${data.payment_token.symbol}`)
        .setThumbnail(data.asset.image_thumbnail_url)
        .setDescription(`by ${data.seller.user?.username}`)
        .setFooter(new Date(`${data.created_date}Z`).toString())
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
            
            // const sales = await openseaClient.events(slug, "successful");
            // sales.forEach(d => {
            //     try {
            //         console.log(d.asset.name);
            //         console.log(d.asset.image_thumbnail_url);
            //         console.log(d.total_price / 1000000000000000000 + " " + d.payment_token.symbol);
            //         console.log(d.seller.user?.username); // seller
            //         console.log(d.asset.owner?.user?.username); // new owner
            //         console.log(d.created_date);
            //         console.log(d.listing_time);
            //         console.log("-----");
            //     } catch (e) {
            //         console.error(e);
            //         console.error(d);
            //     }
            // });
            const lists = await openseaClient.events(slug, "created", lastCreatedTs);
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
                        if (message)
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
