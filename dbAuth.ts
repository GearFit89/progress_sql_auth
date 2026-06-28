import { verify, hash } from 'argon2'
import DbManager, { DataBaseError } from './dbManager'
import { Pool } from 'pg'
import db from './dbConnect';
import jWebTk from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'node:crypto';
export const randstring = (bytes:number=16):string => randomBytes(bytes).toString('hex');// helper function to stop repeating code
// const SECRET_PASSWORD_KEY =process.env.SECRET_PASSWORD_KEY;

const ENV = {
    SECRET_PASSWORD_KEY: process.env.SECRET_PASSWORD_KEY || 'default_secret',
    JWT_ACCESS_KEY: process.env.JWT_ACCESS_KEY || 'default_jwt_secret',
    IS_PROD: process.env.NODE_ENV === 'production',
};

const CONSTANTS = {
    TABLES: {
        AUTH: 'auth'

    },
    TOKENS: {
        ACCESS: 'accessToken',
        REFRESH: 'refreshToken'
    },
    ERRORS: {
        PASSWORD_LENGTH: '1',
        PASSWORD_COMPLEXITY: '2',
        USERNAME_LENGTH: '3',
        EMAIL_FORMAT: '4',
        TAKEN: 'Email or username is already taken',
        SAVE_FAILED: 'Failed to save account data',
        INVALID_LOGIN: 'Invalid log in data',
        INVALID_VERIFY: 'Invalid attempt at verifying account'
    },
    TIME: {
        ONE_DAY_MS: 24 * 60 * 60 * 1000,
        NINETY_DAYS_MS: 90 * 24 * 60 * 60 * 1000,
        ONE_DAY_SEC: 24 * 60 * 60
    }
};

// ---------------------------------------------------------
// 2. INTERFACES
// ---------------------------------------------------------
interface ReturnData<T = any> {
    success: boolean;
    error?: { code?: string; message?: string };
    data?: T;
}

interface AccountSubmit {
    username: string;
    email: string;
    raw_password: string;
}

interface AuthColumns {       
    user_id?: string;
    username?: string;
    email?: string;
    password_hash?: string;
    is_verified?: boolean; // pg parses this natively!
    access_token?: string;
    refresh_token?: string;
}
interface RefreshCookie{
    userId:string;
    token:string;
}
interface JwtCookieData {
    name: string;
    payload: string|RefreshCookie;
    age?: number;
    key?: string;
   
}

// ---------------------------------------------------------
// 3. HELPER FUNCTIONS
// ---------------------------------------------------------
const checkValidAccountInfo = (data: AccountSubmit): ReturnData => {
    const { raw_password, username, email } = data;

    if (raw_password.length < 6) return { success: false, error: { code: CONSTANTS.ERRORS.PASSWORD_LENGTH } };

    const passwRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+={}\[\]:;"'<>,.?/\\-]).{6,40}$/;
    if (!passwRegex.test(raw_password)) return { success: false, error: { code: CONSTANTS.ERRORS.PASSWORD_COMPLEXITY } };

    if (username.length > 30) return { success: false, error: { code: CONSTANTS.ERRORS.USERNAME_LENGTH } };

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (email && !emailRegex.test(email)) return { success: false, error: { code: CONSTANTS.ERRORS.EMAIL_FORMAT } };

    return { success: true };
};

function createJwtCookie(cookieStore:CookieStore, data: JwtCookieData) {
    const KEY = data.key || ENV.JWT_ACCESS_KEY;
    try {
        const token = jWebTk.sign(JSON.stringify(data.payload), KEY);
        cookieStore.set(data.name, token, {
            maxAge: data.age || CONSTANTS.TIME.NINETY_DAYS_MS,
            httpOnly: true,
            secure: ENV.IS_PROD,
            sameSite: !ENV.IS_PROD ? 'lax' : 'strict'
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: { message: `Cookie creation failed for ${data.name}` } };
    }
}


class AuthError extends DataBaseError{
    constructor(msg:string){
        super("Auth error: "+ msg);
    }   
}

interface AccountSubmit{
    username:string;
    email:string;
    raw_password:string;
}




const TABLES ={
    AUTH:'auth',
    PROFILES:"profiles"

}
const COOKIES  ={
    ACCESS:"access_token",
    REFRESH:"refresh_token"

}
interface CookieStore {
    set(name: string, value: string, options?: JwtCookieData|Record<string, any>): void;
    delete(name: string): void;
    get(name: string): string | undefined;
}
export class DbAuth extends DbManager{
    constructor(pool:Pool=db, tools:Record<string, any>){
      
        super( pool);
        this.email = tools.email;
        this.redis = tools.redis;
        this.cookieStore = tools.cookieStore;

    }
    private email:any;
    private redis:any;

private cookieStore:CookieStore;
    private async  updateTokens(id: any, cookieStore:CookieStore, updateDb:boolean=true) {

    try {
        console.log('update data', id);
        const newRefresh = { token: randomBytes(16).toString('hex'), userId:id };
        const newAccess = randomBytes(16).toString('hex');
        const refreshData: JwtCookieData = { name: COOKIES.REFRESH, payload: newRefresh, age: 90 * 24 * 60 * 60 * 1000, }//90 days

        const accessData: JwtCookieData = { name: COOKIES.ACCESS, payload: newAccess, age: 24 * 60 * 60 * 1000, }//1 day
        createJwtCookie(cookieStore, refreshData)
        createJwtCookie(cookieStore, accessData)
        console.log('updates', refreshData, newRefresh, 'a time', accessData, newAccess)
     if(updateDb){
        const updateData = { is_verified: true, refresh_token: newRefresh, access_token: newAccess }
         const rows = await this.from(TABLES.AUTH).update(updateData);
         if (rows.length === 0) {
             return { success: false, error: { message: "Failed to save the user on updating tokens" } }
         }
         return { success: true, data: { newAccess, newRefresh } }
     }

        return { success: true, data: { newAccess, newRefresh } }
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return { error: e, success: false }
    }
}

async logout(cookieStore:CookieStore){
    cookieStore.delete(COOKIES.ACCESS);
    cookieStore.delete(COOKIES.REFRESH);
    return {success:true}


}
async sendNewPasswordLink(email:string, TTL=5 *60 * 60){
   const rows =  await this.from(TABLES.AUTH).select(['user_id'], {SQLStatement:'WHERE email = $1', values:[email]}  );
    if (rows.length === 0 || !rows[0]?.user_id) {
        return { success: false, error: { message: "Failed to save the user on password verifing" } }
    };
    const userId = rows[0].user_id;
    const tokenKey = `email:${email}:new_password_link`;
    const userIdKey = `email:${email}:user_id`;
    const token = randomBytes(16).toString('hex');
    await this.redis.set(tokenKey, token, "EX",TTL );
    await this.redis.set(userIdKey, userId , "EX", TTL);
    this.email.send(email, this.email.templates.newPasswordLink(email,  token))

}
    async verifyNewPassword(email: string, code: string, newPass:string, cookieStore: any) {

        const tokenKey = `email:${email}:new_password_link`;
        const userIdKey = `email:${email}:user_id`;
        
        const token = await this.redis.get(tokenKey);
        const userId = await this.redis.get(userIdKey);
        const newPasswordHash = await hash(newPass);
         
        // Delete both at the same time
        await this.redis.del(tokenKey, userIdKey);
        if (!token || !code || !email || !userId) { return { success: false, error: { message: "Invaild  attempt of verifing password" } } }
        if (token === code) {
            const { data, success } = await this.updateTokens(userId, cookieStore, false);
            if (!success || !data) return { success: false, error: { message: "Could not save jwt" } }


            const updateData:AuthColumns = { is_verified: true, refresh_token: data.newRefresh.token, access_token: data.newAccess, password_hash:newPasswordHash }
            const rows = await this.from(TABLES.AUTH).update(updateData, {userId});
            if (rows.length === 0) {
                return { success: false, error: { message: "Failed to save the user on password verifing" } }
            }
            return { success: true }

        } else {
            return { success: false, error: { message: "Code was not correct" } }

        }
    }
    async deleteAccount(cookieStore:CookieStore){
      const { userId }  =JSON.parse( cookieStore.get(COOKIES.REFRESH ) || '{}') as RefreshCookie;
     if(!userId) return {success:false};

     await  this.from(TABLES.AUTH).delete({userId });
        await this.from(TABLES.PROFILES).delete({userId});


}
 async passwordLogIn({password, username, email}:{password:string, username?:string, email?:string}, cookieStore:CookieStore){
  if(!password || !username ||  !email) return{success:false}
 
     const options = {delPassHash:false, SQLStatement:"WHERE email = $1 OR username = $2 ", values:[email, username]}
  const rows = await this.from(TABLES.AUTH).select(["password_hash", "username", "email", "user_id", "is_verified"], options)// gets the password with the option instead of removing it 
     if (rows.length === 0) return { success: false }
  const data:AuthColumns = rows[0];
  if((data.username === username || data.email === email) && (await verify(data.password_hash as string, password)) && data.is_verified){
const  {data:updateData, success} = await this.updateTokens(data.user_id, cookieStore);
if(!success) return {success:false}

  }else{
      return { success: false, error:{message:"Invaild log in data"} }
  }

return {success:true};

 }
 async signUp(accountData:AccountSubmit, TTL:number=24 * 60 * 60){
    const {success, error} =checkValidAccountInfo(accountData);
    if(!success || error?.code){
        return { success: false, error: { code: error?.code } };
    }
   const  checkAuthData   = await  this.from(TABLES.AUTH).select(['username', 'email', 'is_verified'], {SQLStatement:"WHERE email = $1", values:[accountData.email]});
const data:AuthColumns = checkAuthData[0] || {};
   if((data.username === accountData.username )|| (data.email === accountData.email && data.is_verified)){
    return { success: false, error: { message: "Email or username is already taken" } }
}
    const  userId:string = randomUUID();
    
   const passHash: string = await hash(accountData.raw_password, {
  secret: Buffer.from(ENV.SECRET_PASSWORD_KEY, 'utf-8')
});
    const authData:AuthColumns = {
        user_id:userId,
        username:accountData.username,
        password_hash:passHash,
        email:accountData.email,
        is_verified:false

    }
   const rows = await  this.from(TABLES.AUTH).insert(authData );
   const token = randomBytes(32).toString('hex');
   await this.redis.set(`email:${accountData.email}:token_link`,token, "EX",  TTL);
     await this.redis.set(`email:${accountData.email}:user_id`,  userId  , "EX", TTL)
   this.email.send(accountData.email, this.email.templates.tokenLink(accountData.email, accountData.username, token))
   if(rows.length === 0) return {success:false, error:{message:"Failed to save account data"}}
 const profileRows =  await this.from(TABLES.PROFILES).insert({username:accountData.username, user_id:userId });
   if(profileRows.length === 0){
    await this.from(TABLES.AUTH).delete({});
    return {success:false, error:{message:"Failed to save data to profile"}}

   }
 return {success:true}


 }
 async verifyEmail(email:string, code:string, cookieStore:CookieStore){
   
     const tokenKey = `email:${email}:token_link`;
     const userIdKey = `email:${email}:user_id`;
     const token = await this.redis.get(tokenKey);
     const userId = await this.redis.get(userIdKey);
    
     // Delete both at the same time
     await this.redis.del(tokenKey, userIdKey);
     if(!token || !code|| !email || !userId){return {success:false, error:{message:"Invaild  attempt of verifing account" }}}
    if(token === code){
        const {data, success} =await this.updateTokens(userId, cookieStore, false);
        if (!success || !data) return{ success: false, error: { message: "Could not save jwt" } }


        const updateData = {is_verified:true, refresh_token:data.newRefresh.token, access_token:data.newAccess}
        const rows = await this.from(TABLES.AUTH).update(updateData, {userId});
        if(rows.length === 0){
            return { success: false, error: { message: "Failed to save the user on email verifing" } }
        }
        return {success:true}
       
    }else{
       return { success: false, error: { message: "Code was not correct" } }

    }
    }
    async  veifyTokens({ accessToken, refreshToken, id }: any, cookieStore:CookieStore) {
    console.log('---string vefity--\n')
    try {
        if (!refreshToken || !id) { return { error: ' refresh token not there or id not there', verified: false, update: 0 } }
      
       const rows  = await this.from(TABLES.AUTH).select(['access_token', 'refresh_token'], {SQLStatement:"WHERE user_id = $1", values:[id]})
const data = rows[0];
        if (rows.length=== 0) { return { error: 'error', verified: false, update: 0 } };
        if (!data) {
            return { error: 'data token is missing', verified: false, update: 0 }
        }
        const { refresh_token:session_id, access_token:access_id } = data;
        console.log(data, 'upd saup virg data', refreshToken, accessToken);
        console.log('compare refrsh', session_id.replaceAll('"', ''), 'vs', refreshToken.replaceAll('"', '') as string)
        console.log(access_id.replaceAll('"', ''), 'access vs', accessToken as string)
        if (session_id.replaceAll('"', '') !== refreshToken.replaceAll('"', '') as string) { return { error: ' refresh token are not equal', verified: false, update: 0 } }
        console.warn('refresh equl;;;;;;;;;;;;;;;;;;')
        if (accessToken && accessToken === access_id) {
            return { verified: true, update: 0 }

        } else if (!accessToken) {
            const { success, error } = await this.updateTokens(id, cookieStore)
            if (error) return { error, verified: false, update: -1 };
            return { verified: true, update: 1 }
        } else if (accessToken.replaceAll('"', '') !== access_id) {
            return { error: 'access token is not equal', verified: false, update: 0 }


        }
    }
    catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return { error: errorMessage, verified: false, update: 0 }
    }
}
    
}