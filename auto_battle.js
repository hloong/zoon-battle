const config = require('./config');
const ERC721 = require('./contracts/erc721');
const Web3 = require('web3');
const cache = require('./utils/cache');
const { $get, $post } = require('./utils/axios');
let yags = 0
let battleCount = 0
let winCount = 0

function AutoBattle(config) {
    let self = this;
    self.web3 = new Web3('https://bsc-dataseed.binance.org/');
    self.config = config;
    self.erc721Contract = new ERC721(config.chain, config.zoonNftContract);
}

AutoBattle.prototype.run = async function () {
    let self = this;
    console.log(`ZOON自动Battle脚本启动，当前账号: ${self.config.address}`);
    let timeOut = config.loopSeconds * 1000;
    let count = 1;
    (function iterator() {
        self.runThis(count).then(() => {
            setTimeout(() => {
                count++;
                iterator();
            }, timeOut);
        }).catch((err) => {
            console.log(`error: ${err.message}`);
            console.log(err);
            setTimeout(() => {
                count++;
                iterator();
            }, timeOut);
        })
    })();
}

AutoBattle.prototype.runThis = async function (count) {
    console.log(`============================程序开始第${count}次扫描`);
    const self = this;
    // 转码
    const msg = self.web3.utils.utf8ToHex("zoanisthebestbscnft") 
    // 生成钱包
    const account = self.web3.eth.accounts.privateKeyToAccount(config.privateKey);
    let token = ''
    self.web3.eth.accounts.wallet.add(account);
    self.web3.eth.defaultAccount = account.address;
    // 签名
    self.web3.eth.sign(msg , account.address).then(function (res) {
      token = res
    })
    const petsAvailableArr = []
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    /// 获取宠物id列表
    const petIds = await self.getPetIds(self.config.address);
    const verifyWalletData = await $post('/verifyWallet',{
          id: config.address,
          signature:token
    })
    // 获得签名后的token
    const verifyToken = verifyWalletData.user.token
    const battleWalletData = await $post('/battle/wallet',{
          verifyToken
    })
    // 挑出可战斗宠物
    for (let i = 0; i < petIds.length; i++) {
      const id = petIds[i];
      const res = await $get(`/battle/tokenId/${id}`)
      const totalTurn = res.data.totalTurn
      console.log(`宠物id：${id}  当前可战斗：${totalTurn} 次`);
      if(totalTurn>0){
        petsAvailableArr.push({
          id:res.message*1,
          data:res.data
        })
      }
    }
    console.log(`总宠物数量：${petIds.length}，可用宠物数量: ${petsAvailableArr.length}`);
    if(petsAvailableArr.length === 0){
      console.log('没有可战斗宠物')
      return
    }

    for (let i = 0; i < petsAvailableArr.length; i++) {
      const petItem = petsAvailableArr[i];
      const count = petItem.data.totalTurn
      const id = petItem.id
      for (let j = 0; j < count; j++) {
        // 延迟1.5秒，避免奖励未发放
        await wait(1500)
        const battle = await $post('/battle',{
          token: verifyToken,
          _monster: config.gameIndex,
          _tokenId: id
        })
        const battleWalletData = await $post('/battle/wallet',{
          token:verifyToken
        })  
        if(!battle.success){
          console.log('没有result')
          break;
        }
        const result = battle.data.result
        const exp = battle.data.exp/100
        const reward = (battle.data.reward/1000000000000000000).toFixed(2)
        const resultPetId = battle.data._tokenId
        battleCount = battleCount + 1
        if(result === 'win'){
          yags = yags + (reward*1)
          winCount = winCount + 1
        }
        console.log(
        `本轮第${battleCount}次战斗  
        id:${resultPetId}  
        战斗结果：${result}  
        战斗奖励：${reward}  
        获得经验：${exp}  
        本轮战斗共获得：${yags.toFixed(2)}   
        当前胜率：${winCount/battleCount * 100}%`)
      }
    }
  console.log('本轮战斗结束')

}

/// 获取宠物id列表
AutoBattle.prototype.getPetIds = async function (address) {

    let self = this;
    /// 获取当前账号有几个NFT
    let balance = await self.erc721Contract.balanceOf(address);
    let balanceCacheKey = 'pets_balance';
    let balanceCache = cache.get(balanceCacheKey);
    let balanceChanged = balanceCache != balance;
    if (balanceChanged) {
        cache.set(balanceCacheKey, balance, 1000000000);
    }

    let petIdsCacheKey = "pets_ids";
    let results = cache.get(petIdsCacheKey);
    if (!results || balanceChanged) {
        let promises = [];
        for (var i = 0; i < balance; i++) {
            let p = self.erc721Contract.tokenOfOwnerByIndex(address, i);
            promises.push(p);
        }
        results = await Promise.all(promises);
        cache.set(petIdsCacheKey, results, 10 * 60);//用户余额不变的情况下，缓存10分钟的宠物id列表
    }
    return results;
}

module.exports = AutoBattle;
