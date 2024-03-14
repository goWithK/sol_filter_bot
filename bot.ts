import { Bot, GrammyError, HttpError, session } from 'grammy';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import { limit } from '@grammyjs/ratelimiter';
import { hydrateReply } from '@grammyjs/parse-mode';
import type { ParseModeFlavor } from '@grammyjs/parse-mode';
import { globalConfig, groupConfig, outConfig } from './src/common/limitsConfig';
import { BotContext } from './src/types/index';
import { COMMANDS } from './src/commands/index';
import * as dotenv from 'dotenv';
dotenv.config();

//Env vars
const SOL_FILTER_BOT_TOKEN: string = String(process.env.SOL_FILTER_BOT_TOKEN);

//BOT CONFIG
const bot = new Bot<ParseModeFlavor<BotContext>>(SOL_FILTER_BOT_TOKEN);
const throttler = apiThrottler({
    global: globalConfig,
    group: groupConfig,
    out: outConfig,
});

bot.api.setMyCommands(COMMANDS);
bot.use(hydrateReply);
bot.api.config.use(throttler);

bot.use(
    session({
        initial() {
            // return empty object for now
            return {};
        },
    })
);

bot.use(
    limit({
        // Allow only 3 messages to be handled every 2 seconds.
        timeFrame: 2000,
        limit: 3,

        // This is called when the limit is exceeded.
        onLimitExceeded: async (ctx) => {
            await ctx.reply('Please refrain from sending too many requests!');
        },

        // Note that the key should be a number in string format such as "123456789".
        keyGenerator: (ctx) => {
            return ctx.from?.id.toString();
        },
    })
);

//START COMMAND
bot.command('start', async (ctx) => {
    const chatId = ctx.msg.chat.id;
    await bot.api.sendMessage(
        chatId,
        'Welcome!!!',
        { parse_mode: "HTML" },
    );
});

// Always exit any conversation upon /cancel
bot.command("stop", async (ctx) => {
    await ctx.reply("Leaving...");
});

bot.on(":text", async (ctx) => {
    if (ctx.update.channel_post) {
        const content = ctx.update.channel_post.text;
        const chatId = ctx.update.channel_post.chat.id;
        const messageId = ctx.update.channel_post.message_id;

        const minLP = 20;
        const addLPPerc = 100;
        const holderGTE = 15;
        var isValidHolder = false;
        var isValidLP = false;
        var isValidLPPerc = false;

        const regex = /[+-]?\d+(\.\d+)?/g;
        const stringList = content.split('\n');
        console.log('CA: ', stringList[1])
        stringList.forEach((eachString) => {
            if (eachString.includes('Started:')) {
                let LP = parseFloat(String(eachString.match(regex)));
                console.log('LP: ', LP)
                if (LP >= minLP) {isValidLP = true}
                let LPperc = parseInt(String(eachString.split('+')[1].match(regex)));
                console.log('LP add: ', LPperc)
                if (LPperc === addLPPerc) {isValidLPPerc = true}
            }
            else if (eachString.includes('Top Holders:')) {
                let itemIndex = stringList.indexOf(eachString);
                let stopIndex = stringList.findIndex(function(eachItem) {
                    if (eachItem.includes('Score: ')) {
                        return stringList.indexOf(eachItem)
                    }
                })
                for (let i = 0; i < stopIndex - itemIndex - 2; i++) {
                    let holderPerc = parseFloat(String(stringList[itemIndex + i + 1].split('|')[1].trim().match(regex)))
                    if (holderPerc >= holderGTE && !stringList[itemIndex + i + 1].includes('Raydium')) {
                        isValidHolder = true;
                    }
                    console.log(stringList[itemIndex + i + 1].split('|')[0], holderPerc)
                }
            }
        })

        if (isValidHolder && isValidLPPerc && isValidLP) {
            await bot.api.sendMessage(
                chatId,
                content,
                { parse_mode: "HTML" },
            );
        } else {
            await bot.api.deleteMessage(chatId, messageId)
        }
    }
});

//CRASH HANDLER
bot.catch((err) => {
    const ctx = err.ctx;
    console.log(`[bot-catch][Error while handling update ${ctx.update.update_id}]`, err.error);
    const e = err.error;

    if (e instanceof GrammyError) {
        console.log(`[bot-catch][Error in request ${ctx.update.update_id}]`, e.message, e.stack)
    } else if (e instanceof HttpError) {
        console.log(`[bot-catch][Error in request ${ctx.update.update_id}]`, e.error, e.stack)
    } else {
        console.log(`[bot-catch][Error in request ${ctx.update.update_id}]`, e)
    }
});

export { bot };
