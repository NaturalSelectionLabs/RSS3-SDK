import type { AnyObject } from '../types/extend';
import Main, { IOptionsMnemonic, IOptionsPrivateKey, IOptionsSign } from './index';
import { ethers } from 'ethers';
import utils from './utils';

class Account {
    private main: Main;
    private signer: ethers.Wallet;
    private agentSigner: ethers.Wallet;
    mnemonic: string | undefined;
    privateKey: string | undefined;
    address: string;

    constructor(main: Main) {
        this.main = main;

        if ((<IOptionsMnemonic>main.options).mnemonic) {
            // mnemonic
            this.signer = ethers.Wallet.fromMnemonic((<IOptionsMnemonic>main.options).mnemonic);
        } else if ((<IOptionsPrivateKey>main.options).privateKey) {
            // privateKey
            this.signer = new ethers.Wallet((<IOptionsPrivateKey>main.options).privateKey);
        } else if ((<IOptionsSign>main.options).address && (<IOptionsSign>main.options).sign) {
            // custom sign
            this.address = (<IOptionsSign>main.options).address;
        } else {
            // create new
            this.signer = ethers.Wallet.createRandom({
                path: (<IOptionsMnemonic>main.options).mnemonicPath,
            });
            this.main.files.new(this.signer.address);
        }
        if (this.signer) {
            this.mnemonic = this.signer.mnemonic.phrase;
            this.privateKey = this.signer.privateKey.slice(2);
            this.address = this.signer.address;
        }

        utils.indexeddb
            .get(this.address)
            .then((db: any) => {
                if (db.address && db.privateKey) {
                    this.agentSigner = new ethers.Wallet(db.privateKey);
                }
            })
            .catch(() => {
                this.agentSigner = ethers.Wallet.createRandom();
                utils.indexeddb.set(this.address, {
                    privateKey: this.agentSigner.privateKey.slice(2),
                });
            });
    }

    async sign(obj: AnyObject) {
        obj.agent_id = this.agentSigner.address;
        const agentMessage = `Hi, RSS3. I'm your agent ${obj.agent_id}`;
        if (!obj.agent_signature || ethers.utils.verifyMessage(agentMessage, obj.signature) !== obj.id) {
            if (this.signer) {
                obj.signature = await this.signer.signMessage(agentMessage);
            } else if ((<IOptionsSign>this.main.options).sign) {
                obj.signature = await (<IOptionsSign>this.main.options).sign(agentMessage);
            }
        }
        obj.agent_signature = await this.agentSigner.signMessage(this.stringifyObj(obj));
    }

    check(obj: AnyObject, address = this.address) {
        if (this.compatibleCheck(obj)) {
            return true;
        }
        if (!obj.signature) {
            return false;
        } else {
            if (obj.agent_signature && obj.agent_id) {
                return (
                    ethers.utils.verifyMessage(`Hi, RSS3. I'm your agent ${obj.agent_id}`, obj.signature) === obj.id &&
                    ethers.utils.verifyMessage(this.stringifyObj(obj), obj.agent_signature) === obj.agent_id
                );
            } else {
                return ethers.utils.verifyMessage(this.stringifyObj(obj), obj.signature) === address;
            }
        }
    }

    stringifyObj(obj: AnyObject) {
        const removeNotSignProperties = (obj: AnyObject) => {
            obj = JSON.parse(JSON.stringify(obj));
            for (let key in obj) {
                if (key[0] === '@' || key === 'signature' || key === 'agent_signature') {
                    delete obj[key];
                } else if (typeof obj[key] === 'object') {
                    obj[key] = removeNotSignProperties(obj[key]);
                }
            }
            return obj;
        };

        type mulripleStringArray = (string | mulripleStringArray)[];
        const obj2Array = (obj: AnyObject): mulripleStringArray[] => {
            return Object.keys(obj)
                .sort()
                .map((key) => {
                    if (typeof obj[key] === 'object') {
                        return [key, obj2Array(obj[key])];
                    } else {
                        return [key, obj[key]];
                    }
                });
        };

        let message = obj2Array(removeNotSignProperties(obj));
        return JSON.stringify(message);
    }

    // dirty logic
    private compatibleCheck(obj: AnyObject) {
        if (!obj.signature) {
            return false;
        } else {
            if (obj['@version'] && obj['@version'] === 'rss3.io/version/v0.1.0') {
                const stringify_v0_1_0 = (obj: AnyObject) => {
                    // Implementation error of v0.1.0, retaining error logic for compatibility with data of v0.1.0
                    function removeNotSignProperties(obj: AnyObject) {
                        obj = JSON.parse(JSON.stringify(obj));
                        for (let key in obj) {
                            if (key[0] === '@' || key === 'signature') {
                                delete obj[key];
                            } else if (typeof obj[key] === 'object') {
                                removeNotSignProperties(obj[key]);
                            }
                        }
                        return obj;
                    }

                    type mulripleStringArray = (string | mulripleStringArray)[];
                    function obj2Array(obj: AnyObject): mulripleStringArray[] {
                        return Object.keys(obj)
                            .sort()
                            .map((key) => {
                                if (typeof obj[key] === 'object') {
                                    return [key, obj2Array(obj[key])];
                                } else {
                                    return [key, obj[key]];
                                }
                            });
                    }

                    let message = obj2Array(removeNotSignProperties(obj));
                    return JSON.stringify(message);
                };
                return ethers.utils.verifyMessage(stringify_v0_1_0(obj), obj.signature) === this.address;
            } else {
                return false;
            }
        }
    }
}

export default Account;