import {Box} from "../shapes/Box";
import {Shape} from "../shapes/Shape";
import {Hit} from "../../math/Hit";
import {Ray} from "../../math/Ray";
import {NoHit} from "../../math/Hit";
import {SharedNode} from "./SharedNode";
import {Mesh} from "../shapes/Mesh";
import {IPointer} from "../../../pointer/IPointer";
import {Triangle} from "../shapes/Triangle";
import {ByteArrayBase} from "../../../pointer/ByteArrayBase";
/**
 * Created by Nidin Vinayakan on 10-01-2016.
 */
export class SharedTree implements IPointer {

    size:number;

    constructor(public box:Box,
                public root:SharedNode) {

    }

    write(memory:DataView, offset:number):number {
        return offset;
    }

    static newTree(shapes:Shape[], box:Box = null):SharedTree {
        console.time("Building k-d tree (" + shapes.length + " shapes)... ");
        box = box ? box : Box.boxForShapes(shapes);
        var node:SharedNode = SharedNode.newNode(shapes);
        node.split(0);
        console.timeEnd("Building k-d tree (" + shapes.length + " shapes)... ");
        return new SharedTree(box, node);
    }

    intersect(r:Ray):Hit {
        var t = this.box.intersect(r);
        if (t.max < t.min || t.max <= 0) {
            return NoHit;
        }
        return this.root.intersect(r, t.min, t.max);
    }

    static fromJson(tree:SharedTree, mesh:Mesh):SharedTree {
        var box:Box = Box.fromJson(tree.box);
        var node:SharedNode = SharedNode.fromJson(tree.root);
        node.mesh = mesh;
        return new SharedTree(box, node);
    }

    static buildAndWrite(memory:ByteArrayBase, shapes:Shape[], box:Box):number {
        console.time("Building k-d tree (" + shapes.length + " shapes)... ");

        //offset one Int32 to store tree length at the end
        var startPosition:number = memory.position;
        var endPosition:number;
        memory.position += ByteArrayBase.SIZE_OF_INT32;
        var node:SharedNode = SharedNode.newNode(shapes);
        node.memory = memory;
        node.split(0);
        endPosition = memory.position;
        memory.position = startPosition;
        memory.writeInt(endPosition - startPosition);
        memory.position = endPosition;
        console.timeEnd("Building k-d tree (" + shapes.length + " shapes)... ");


        return memory.position;
    }
}
