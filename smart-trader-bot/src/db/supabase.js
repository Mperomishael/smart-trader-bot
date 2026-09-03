const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = require('../config');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---- traders -------------------------------------------------------------
async function upsertTraders(traders) {
  if (!traders.length) return;
  const { error } = await supabase.from('traders').upsert(traders, { onConflict: 'address' });
  if (error) throw error;
}

async function deactivateTradersNotIn(addresses) {
  if (!addresses.length) return;
  const { error } = await supabase
    .from('traders')
    .update({ active: false })
    .not('address', 'in', `(\( {addresses.map((a) => `" \){a}"`).join(',')})`);
  if (error) throw error;
}

async function getActiveTraders() {
  const { data, error } = await supabase.from('traders').select('*').eq('active', true);
  if (error) throw error;
  return data || [];
}

async function getTrader(address) {
  const { data, error } = await supabase.from('traders').select('*').eq('address', address).maybeSingle();
  if (error) throw error;
  return data;
}

// ---- coin subscriptions --------------------------------------------------
async function follow(chatId, coin) {
  const { error } = await supabase.from('subscriptions').upsert({ chat_id: chatId, coin });
  if (error) throw error;
}

async function unfollow(chatId, coin) {
  const { error } = await supabase.from('subscriptions').delete().eq('chat_id', chatId).eq('coin', coin);
  if (error) throw error;
}

async function getFollowedCoins(chatId) {
  const { data, error } = await supabase.from('subscriptions').select('coin').eq('chat_id', chatId);
  if (error) throw error;
  return (data || []).map((r) => r.coin);
}

async function getSubscribersForCoin(coin) {
  const { data, error } = await supabase.from('subscriptions').select('chat_id').eq('coin', coin);
  if (error) throw error;
  return (data || []).map((r) => r.chat_id);
}

// ---- trader subscriptions (NEW) ------------------------------------------
async function followTrader(chatId, traderAddress) {
  const { error } = await supabase
    .from('trader_subscriptions')
    .upsert({ chat_id: chatId, trader_address: traderAddress });
  if (error) throw error;
}

async function unfollowTrader(chatId, traderAddress) {
  const { error } = await supabase
    .from('trader_subscriptions')
    .delete()
    .eq('chat_id', chatId)
    .eq('trader_address', traderAddress);
  if (error) throw error;
}

async function getFollowedTraders(chatId) {
  const { data, error } = await supabase
    .from('trader_subscriptions')
    .select('trader_address')
    .eq('chat_id', chatId);
  if (error) throw error;
  return (data || []).map((r) => r.trader_address);
}

async function getSubscribersForTrader(traderAddress) {
  const { data, error } = await supabase
    .from('trader_subscriptions')
    .select('chat_id')
    .eq('trader_address', traderAddress);
  if (error) throw error;
  return (data || []).map((r) => r.chat_id);
}

// ---- open positions ------------------------------------------------------
async function getOpenPosition(traderAddress, coin) {
  const { data, error } = await supabase
    .from('open_positions')
    .select('*')
    .eq('trader_address', traderAddress)
    .eq('coin', coin)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertOpenPosition(pos) {
  const { error } = await supabase
    .from('open_positions')
    .upsert(pos, { onConflict: 'trader_address,coin' });
  if (error) throw error;
}

async function clearOpenPosition(traderAddress, coin) {
  const { error } = await supabase
    .from('open_positions')
    .delete()
    .eq('trader_address', traderAddress)
    .eq('coin', coin);
  if (error) throw error;
}

// ---- fill dedup ----------------------------------------------------------
async function isFillSeen(tid) {
  const { data, error } = await supabase.from('seen_fills').select('tid').eq('tid', tid).maybeSingle();
  if (error) throw error;
  return !!data;
}

async function markFillSeen(tid) {
  await supabase.from('seen_fills').upsert({ tid }, { onConflict: 'tid', ignoreDuplicates: true });
}

async function pruneOldFills(olderThanHours = 48) {
  const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000).toISOString();
  await supabase.from('seen_fills').delete().lt('seen_at', cutoff);
}

module.exports = {
  supabase,
  upsertTraders,
  deactivateTradersNotIn,
  getActiveTraders,
  getTrader,
  follow,
  unfollow,
  getFollowedCoins,
  getSubscribersForCoin,
  followTrader,
  unfollowTrader,
  getFollowedTraders,
  getSubscribersForTrader,
  getOpenPosition,
  upsertOpenPosition,
  clearOpenPosition,
  isFillSeen,
  markFillSeen,
  pruneOldFills,
};
