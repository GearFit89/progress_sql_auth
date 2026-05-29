import db from "./dbConnect";
import getDatabaseVersion from "./versionGetter";
import { Pool } from 'pg';
import EventEmitter from 'events'// on error to get errors from the manager
// for auth set up in a second
export class DataBaseError extends Error {
    constructor(message:string="Database operation failed") {
        super(message);
        this.name = "DataBaseError";
    }
}
export class DbManager extends EventEmitter {
    private db:Pool;
    
   
    protected table:string|null=null;
    constructor(  pool:Pool=db, options:Record<string, any>={}){
        super();
        this.db = pool;
        getDatabaseVersion();
        // tracks the use
        //this.condition = `WHERE user_id = ${userId};`;//user is set by the server 

    };
   private delPassHash(rows: any[]): any[] {
    // We use .map to return a clean, new array without the sensitive data
    return rows.map(row => {
        // Use the exact name from your SQL schema (password_hash)
        if ('password_hash' in row) {
            delete row.password_hash;
        }
        // Also check for camelCase just in case you transformed it earlier
        
        return row;
    });
}
    public from(tableName:string){ this.table = tableName; return this};
    public async update(columnsToUpdate: Record<string, any>, { userId, table }: { userId?: string, table?: string } = {}):Promise<any []>{
        try{
        if(!table && !this.table) throw new DataBaseError("Table name must be specified either in the constructor or in the update method.");
        const curTable = this.table || table;
        const columnLength = Object.keys(columnsToUpdate).length;
        if(columnLength === 0) throw new DataBaseError("No columns provided for update.");
        const setExpression = Object.keys(columnsToUpdate).map((col, i)=>` ${col} = $${i+1}`).join(', ')
        const values = Object.values(columnsToUpdate)
        values.push(userId);
        const query = `
        UPDATE ${curTable}
        SET ${setExpression}
        WHERE user_id = $${columnLength +1}
        RETURNING *;


        `
        const result = await this.db.query(query, values);
       return this.delPassHash( result?.rows || []);
        }catch(e){
            this.emit("error", e);
            return [];
        }
      

    }
   public async insert(columnsToInsert:Record<string, any>, table?:string):Promise<any []>{
       try{
    if(!table && !this.table) throw new DataBaseError("Table name must be specified either in the constructor or in the insert method.");
        const columnLength = Object.keys(columnsToInsert).length;
        if(columnLength === 0) throw new DataBaseError("No columns provided for insert.");
        const columns = Object.keys(columnsToInsert).join(", ");
       const curTable = this.table || table;
       const values = Object.values(columnsToInsert);
       const valuesStr = values.map((_, i)=>`$${i+1} `).join(', ');
        const query  = `
        INSERT INTO ${curTable}
        (${columns})
        VALUES (${valuesStr})
        RETURNING *;

        `
       const result = await this.db.query(query, values);
      return this.delPassHash( result?.rows || []);
       } catch (e) {
           this.emit("error", e);
           return [];
       }
   }

    public async select(columnsToSel: string[] | '*', {
        SQLStatement = "",
        values = [], // Casting or using a broader type
        delPassHash = true
    }: {
        SQLStatement?: string,
        values?: any[],
        delPassHash?: boolean
        
    } = {},table?: string): Promise<any[]> {
        try{
        if (!table && !this.table) throw new DataBaseError("Table name must be specified either in the constructor or in the update method.");
        const curTable = this.table || table;
        const columnLength = columnsToSel.length || 1;
        if (columnLength === 0 ) throw new DataBaseError("No columns provided for update.");
        const selExpression =  columnsToSel === '*'? '*' : columnsToSel.join(', ')
            
        const query = `
        SELECT ${selExpression}
        FROM ${curTable}
        ${SQLStatement || ''};
       
       


        `
        const result = await this.db.query(query, values);
       return delPassHash ? this.delPassHash( result?.rows || []): result?.rows || [];
    } catch(e) {
        this.emit("error", e);
        return [];
    }

    }
    public async delete({
        extraSQL = "",
        extraValues = [], // Casting or using a broader type
        userId=''
    }: {
        extraSQL?: string,
        extraValues?: any[],
        delPassHash?: boolean 
        userId?:string;
    } = {}, table?:string): Promise<any[]> {
        try{
        if (!table && !this.table ||(!userId  && (extraValues.length===0 || !extraSQL))) throw new DataBaseError("Table name must be specified either in the constructor or in the update method.");
        const curTable = this.table || table;
        const values = extraValues ?? [userId];
        const query = `
        DELETE 
        FROM ${curTable}
        
          
      WHERE user_id = $1
        ${extraSQL}
        RETURNING *;
       


        `
        const result = await this.db.query(query,values);
       return this.delPassHash( result?.rows || []);

    } catch(e) {
        this.emit("error", e);
        return [];
    }
    }
    public cacSqlValues(arr:any [], intiNumber:number=1):string{
        return arr.map((_, i)=>`$${i+intiNumber}`).join(', ')

    }
    public cacSqlWhere(arr: any[], intiNumber: number = 1): string {
        return arr.map((item, i) => `${item} = $${i + intiNumber}`).join(', ')

    }

}
export default DbManager;
