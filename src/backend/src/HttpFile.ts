/**
 * Created by Nidin Vinayakan on 3/2/2016.
 */
export class HttpFile {

    private _path:string;
    private _isDirectory:boolean;

    get path():string{
        return this._path;
    }
    get isDirectory():boolean{
        return this._isDirectory;
    }

    constructor(path:string="", isDirectory:boolean=false) {
        this._path = path;
        this._isDirectory = isDirectory;
    }
    isAbsolute():boolean{
        return this._path.indexOf("http") > -1;
    }
    exists():Promise<boolean>{
        return new Promise(function(resolve, reject){

        });
    }
    load():Promise<Response>{
        return new Promise(function(resolve, reject){

        });
    }

    getAbsolutePath():string {
        return this._path;
    }
}