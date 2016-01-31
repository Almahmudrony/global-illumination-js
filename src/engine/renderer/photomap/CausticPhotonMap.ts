import {CausticPhotonMapInterface} from "../../core/CausticPhotonMapInterface";
/**
 * Created by Nidin Vinayakan on 22/1/2016.
 */
class NearestPhotons {

    found:number;

    px:number;

    py:number;

    pz:number;

    private max:number;

    private gotHeap:boolean;

    protected dist2:number[];

    protected index:Photon[];

    constructor (p:Point3, n:number, maxDist2:number) {
        this.max = n;
        this.found = 0;
        this.gotHeap = false;
        this.px = p.x;
        this.py = p.y;
        this.pz = p.z;
        this.dist2 = new Array((n + 1));
        this.index = new Array((n + 1));
        this.dist2[0] = maxDist2;
    }

    reset(p:Point3, maxDist2:number) {
        this.found = 0;
        this.gotHeap = false;
        this.px = p.x;
        this.py = p.y;
        this.pz = p.z;
        this.dist2[0] = maxDist2;
    }

    checkAddNearest(p:Photon) {
        let fdist2:number = p.getDist2(this.px, this.py, this.pz);
        if ((fdist2 < this.dist2[0])) {
            if ((this.found < this.max)) {
                this.found++;
                this.dist2[this.found] = fdist2;
                this.index[this.found] = p;
            }
            else {
                let j:number;
                let parent:number;
                if (!this.gotHeap) {
                    let dst2:number;
                    let phot:Photon;
                    let halfFound:number = (this.found + 1);
                    for (let k:number = halfFound; (k >= 1); k--) {
                        parent = k;
                        phot = this.index[k];
                        dst2 = this.dist2[k];
                        while ((parent <= halfFound)) {
                            j = (parent + parent);
                            if (((j < this.found)
                                && (this.dist2[j] < this.dist2[(j + 1)]))) {
                                j++;
                            }

                            if ((dst2 >= this.dist2[j])) {
                                break;
                            }

                            this.dist2[parent] = this.dist2[j];
                            this.index[parent] = this.index[j];
                            parent = j;
                        }

                        this.dist2[parent] = dst2;
                        this.index[parent] = phot;
                    }

                    this.gotHeap = true;
                }

                parent = 1;
                j = 2;
                while ((j <= this.found)) {
                    if (((j < this.found)
                        && (this.dist2[j] < this.dist2[(j + 1)]))) {
                        j++;
                    }

                    if ((fdist2 > this.dist2[j])) {
                        break;
                    }

                    this.dist2[parent] = this.dist2[j];
                    this.index[parent] = this.index[j];
                    parent = j;
                    j = (j + j);
                }

                this.dist2[parent] = fdist2;
                this.index[parent] = p;
                this.dist2[0] = this.dist2[1];
            }

        }

    }
}

class Photon {

    x:number;

    y:number;

    z:number;

    dir:number;

    power:number;

    flags:number;

    static SPLIT_X:number = 0;

    static SPLIT_Y:number = 1;

    static SPLIT_Z:number = 2;

    static SPLIT_MASK:number = 3;

    constructor (p:Point3, dir:Vector3, power:Color) {
        this.x = p.x;
        this.y = p.y;
        this.z = p.z;
        this.dir = this.dir.encode();
        this.power = this.power.toRGBE();
        this.flags = SPLIT_X;
    }

    setSplitAxis(axis:number) {
        SPLIT_MASK;
        this.flags = (this.flags | axis);
    }

    getCoord(axis:number):number {
        switch (axis) {
            case SPLIT_X:
                return this.x;
                break;
            case SPLIT_Y:
                return this.y;
                break;
            default:
                return this.z;
                break;
        }

    }

    getDist1(px:number, py:number, pz:number):number {
        switch ((this.flags & SPLIT_MASK)) {
            case SPLIT_X:
                return (px - this.x);
                break;
            case SPLIT_Y:
                return (py - this.y);
                break;
            default:
                return (pz - this.z);
                break;
        }

    }

    getDist2(px:number, py:number, pz:number):number {
        let dx:number = (this.x - px);
        let dy:number = (this.y - py);
        let dz:number = (this.z - pz);
        return ((dx * dx)
        + ((dy * dy)
        + (dz * dz)));
    }
}
export class CausticPhotonMap implements CausticPhotonMapInterface {

    private photonList:ArrayList<Photon>;

    private photons:Photon[];

    private storedPhotons:number;

    private halfStoredPhotons:number;

    private log2n:number;

    private gatherNum:number;

    private gatherRadius:number;

    private bounds:BoundingBox;

    private filterValue:number;

    private maxPower:number;

    private maxRadius:number;

    private numEmit:number;

    constructor (options:Options) {
        this.numEmit = options.getInt("caustics.emit", 10000);
        this.gatherNum = options.getInt("caustics.gather", 50);
        this.gatherRadius = options.getFloat("caustics.radius", 0.5);
        this.filterValue = options.getFloat("caustics.filter", 1.1);
        this.bounds = new BoundingBox();
        this.maxPower = 0;
        this.maxRadius = 0;
    }

    prepare(sceneBounds:BoundingBox) {
        this.photonList = new ArrayList<Photon>();
        this.photonList.add(null);
        this.photons = null;
        this.halfStoredPhotons = 0;
        this.storedPhotons = 0;
    }

    private locatePhotons(np:NearestPhotons) {
        let dist1d2:number[] = new Array(this.log2n);
        let chosen:number[] = new Array(this.log2n);
        let i:number = 1;
        let level:number = 0;
        let cameFrom:number;
        while (true) {
            while ((i < this.halfStoredPhotons)) {
                let dist1d:number = this.photons[i].getDist1(np.px, np.py, np.pz);
                dist1d2[level] = (dist1d * dist1d);
                i = (i + i);
                if ((dist1d > 0)) {
                    i++;
                }

                chosen[level++] = i;
            }

            np.checkAddNearest(this.photons[i]);
            for (
                ; ((dist1d2[level] >= np.dist2[0])
            || (cameFrom != chosen[level]));
            ) {
                cameFrom = i;
                1;
                level--;
                if ((i == 0)) {
                    return;
                }

            }

            np.checkAddNearest(this.photons[i]);
            i = (chosen[level++] | 1);
            // The operator should be an XOR ^ instead of an OR, but not available in CodeDOM
        }

    }

    private balance() {
        if ((this.storedPhotons == 0)) {
            return;
        }

        this.photons = this.photonList.toArray(new Array(this.photonList.size()));
        this.photonList = null;
        let temp:Photon[] = new Array((this.storedPhotons + 1));
        this.balanceSegment(temp, 1, 1, this.storedPhotons);
        this.photons = temp;
        this.halfStoredPhotons = (this.storedPhotons / 2);
        this.log2n = (<number>(Math.ceil((Math.log(this.storedPhotons) / Math.log(2)))));
    }

    private balanceSegment(temp:Photon[], index:number, start:number, end:number) {
        let median:number = 1;
        while (((4 * median)
        <= ((end - start)
        + 1))) {
            median = (median + median);
        }

        if (((3 * median)
            <= ((end - start)
            + 1))) {
            median = (median + median);
            median = (median
            + (start - 1));
        }
        else {
            median = ((end - median)
            + 1);
        }

        let axis:number = Photon.SPLIT_Z;
        let extents:Vector3 = this.bounds.getExtents();
        if (((extents.x > extents.y)
            && (extents.x > extents.z))) {
            axis = Photon.SPLIT_X;
        }
        else if ((extents.y > extents.z)) {
            axis = Photon.SPLIT_Y;
        }

        let left:number = start;
        let right:number = end;
        while ((right > left)) {
            let v:number = this.photons[right].getCoord(axis);
            let i:number = (left - 1);
            let j:number = right;
            while (true) {
                while ((this.photons[++i].getCoord(axis) < v)) {

                }

                while (((this.photons[--j].getCoord(axis) > v)
                && (j > left))) {

                }

                if ((i >= j)) {
                    break;
                }

                this.swap(i, j);
            }

            this.swap(i, right);
            if ((i >= median)) {
                right = (i - 1);
            }

            if ((i <= median)) {
                left = (i + 1);
            }

        }

        temp[index] = this.photons[median];
        temp[index].setSplitAxis(axis);
        if ((median > start)) {
            if ((start
                < (median - 1))) {
                let tmp:number;
                switch (axis) {
                    case Photon.SPLIT_X:
                        tmp = this.bounds.getMaximum().x;
                        this.bounds.getMaximum().x = temp[index].x;
                        this.balanceSegment(temp, (2 * index), start, (median - 1));
                        this.bounds.getMaximum().x = tmp;
                        break;
                    case Photon.SPLIT_Y:
                        tmp = this.bounds.getMaximum().y;
                        this.bounds.getMaximum().y = temp[index].y;
                        this.balanceSegment(temp, (2 * index), start, (median - 1));
                        this.bounds.getMaximum().y = tmp;
                        break;
                    default:
                        tmp = this.bounds.getMaximum().z;
                        this.bounds.getMaximum().z = temp[index].z;
                        this.balanceSegment(temp, (2 * index), start, (median - 1));
                        this.bounds.getMaximum().z = tmp;
                        break;
                }

            }
            else {
                temp[(2 * index)] = this.photons[start];
            }

        }

        if ((median < end)) {
            if (((median + 1)
                < end)) {
                let tmp:number;
                switch (axis) {
                    case Photon.SPLIT_X:
                        tmp = this.bounds.getMinimum().x;
                        this.bounds.getMinimum().x = temp[index].x;
                        this.balanceSegment(temp, ((2 * index)
                        + 1), (median + 1), end);
                        this.bounds.getMinimum().x = tmp;
                        break;
                    case Photon.SPLIT_Y:
                        tmp = this.bounds.getMinimum().y;
                        this.bounds.getMinimum().y = temp[index].y;
                        this.balanceSegment(temp, ((2 * index)
                        + 1), (median + 1), end);
                        this.bounds.getMinimum().y = tmp;
                        break;
                    default:
                        tmp = this.bounds.getMinimum().z;
                        this.bounds.getMinimum().z = temp[index].z;
                        this.balanceSegment(temp, ((2 * index)
                        + 1), (median + 1), end);
                        this.bounds.getMinimum().z = tmp;
                        break;
                }

            }
            else {
                temp[((2 * index)
                + 1)] = this.photons[end];
            }

        }

    }

    private swap(i:number, j:number) {
        let tmp:Photon = this.photons[i];
        this.photons[i] = this.photons[j];
        this.photons[j] = tmp;
    }

    store(state:ShadingState, dir:Vector3, power:Color, diffuse:Color) {
        if (((state.getDiffuseDepth() == 0)
            && ((state.getReflectionDepth() > 0)
            || (state.getRefractionDepth() > 0)))) {
            //  this is a caustic photon
            let p:Photon = new Photon(state.getPoint(), dir, power);
            this;
            this.storedPhotons++;
            this.photonList.add(p);
            this.bounds.include(new Point3(p.x, p.y, p.z));
            this.maxPower = Math.max(this.maxPower, power.getMax());
        }

    }

    init() {
        UI.printInfo(Module.LIGHT, "Balancing caustics photon map ...");
        let t:Timer = new Timer();
        t.start();
        this.balance();
        t.end();
        UI.printInfo(Module.LIGHT, "Caustic photon map:");
        UI.printInfo(Module.LIGHT, "  * Photons stored:  %d", this.storedPhotons);
        UI.printInfo(Module.LIGHT, "  * Photons/estimate:%d", this.gatherNum);
        this.maxRadius = (1.4 * (<number>(Math.sqrt((this.maxPower * this.gatherNum)))));
        UI.printInfo(Module.LIGHT, "  * Estimate radius: %.3f", this.gatherRadius);
        UI.printInfo(Module.LIGHT, "  * Maximum radius:  %.3f", this.maxRadius);
        UI.printInfo(Module.LIGHT, "  * Balancing time:  %s", t.toString());
        if ((this.gatherRadius > this.maxRadius)) {
            this.gatherRadius = this.maxRadius;
        }

    }

    getSamples(state:ShadingState) {
        if ((this.storedPhotons == 0)) {
            return;
        }

        let np:NearestPhotons = new NearestPhotons(state.getPoint(), this.gatherNum, (this.gatherRadius * this.gatherRadius));
        this.locatePhotons(np);
        if ((np.found < 8)) {
            return;
        }

        let ppos:Point3 = new Point3();
        let pdir:Vector3 = new Vector3();
        let pvec:Vector3 = new Vector3();
        let invArea:number = (1
        / ((<number>(Math.PI)) * np.dist2[0]));
        let maxNDist:number = (np.dist2[0] * 0.05);
        let f2r2:number = (1
        / (this.filterValue
        * (this.filterValue * np.dist2[0])));
        let fInv:number = (1 / (1 - (2 / (3 * this.filterValue))));
        for (let i:number = 1; (i <= np.found); i++) {
            let phot:Photon = np.index[i];
            Vector3.decode(phot.dir, pdir);
            let cos:number = (Vector3.dot(pdir, state.getNormal()) * -1);
            if ((cos > 0.001)) {
                ppos.set(phot.x, phot.y, phot.z);
                Point3.sub(ppos, state.getPoint(), pvec);
                let pcos:number = Vector3.dot(pvec, state.getNormal());
                if (((pcos < maxNDist)
                    && (pcos
                    > (maxNDist * -1)))) {
                    let sample:LightSample = new LightSample();
                    sample.setShadowRay(new Ray(state.getPoint(), pdir.negate()));
                    sample.setRadiance((new Color() + setRGBE(np.index[i].power).mul((invArea / cos))), Color.BLACK);
                    sample.getDiffuseRadiance().mul(((1 - (<number>(Math.sqrt((np.dist2[i] * f2r2)))))
                    * fInv));
                    state.addSample(sample);
                }

            }

        }

    }



allowDiffuseBounced():boolean {
    return false;
}

allowReflectionBounced():boolean {
    return true;
}

allowRefractionBounced():boolean {
    return true;
}

numEmit():number {
    return this.numEmit;
}
}