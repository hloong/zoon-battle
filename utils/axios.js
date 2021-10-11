const axios = require("axios")  // npm install axios -D
const axiosRetry = require("axios-retry"); // npm install axios-retry -D
const baseURL = 'https://api.cryptozoon.io'

const $http = axios.create({
    baseURL,
})
axiosRetry($http, { retries: 5, retryDelay:3000 });

function $get (url,params){
    return new Promise((resolve,reject)=>{
        $http.get(url,{
            params,
        }).then(res=>{
          resolve(res.data);
        }).catch(error=>{
          reject('网络异常:',error);
        })
    })
}

function $post (url,params) {
    return new Promise((resolve,reject)=>{
        $http.post(url,params).then(res=>{
          resolve(res.data);
        }).catch(error=>{
          reject('网络异常:',error);
        })
    })
}

module.exports = {
  $get,
  $post
}