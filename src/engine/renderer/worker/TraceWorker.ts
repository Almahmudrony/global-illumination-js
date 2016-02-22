import {Camera} from "../../scene/Camera";
import {Scene} from "../../scene/Scene";
import {RGBA} from "../../math/Color";
import {Color} from "../../math/Color";
import {Ray} from "../../math/Ray";
import {Cube} from "../../scene/shapes/Cube";
import {Vector3} from "../../math/Vector3";
import {DiffuseMaterial} from "../../scene/materials/DiffuseMaterial";
import {Sphere} from "../../scene/shapes/Sphere";
import {LightMaterial} from "../../scene/materials/LightMaterial";
import {LinearAttenuation} from "../../scene/materials/Attenuation";
import {Renderer} from "../Renderer";
import {SpecularMaterial} from "../../scene/materials/SpecularMaterial";
import {SharedScene} from "../../scene/SharedScene";
import {DirectMemory} from "../../../pointer/DirectMemory";
/**
 * Created by Nidin Vinayakan on 10-01-2016.
 */
export class TraceWorker {

    static INIT:string = "INIT";
    static INITED:string = "INITED";
    static TRACE:string = "TRACE";
    static TRACED:string = "TRACED";
    static TERMINATE:string = "TERMINATE";
    static id:number;

    command:any;
    paused:boolean;
    flags:Uint8Array;
    pixelMemory:Uint8ClampedArray;
    sampleMemory:Float32Array;
    sceneMemory:DirectMemory;
    camera:Camera;
    scene:Scene;
    full_width:number;
    full_height:number;
    width:number;
    height:number;
    xoffset:number;
    yoffset:number;
    samples:Color[];
    cameraSamples:number;
    absCameraSamples:number;
    hitSamples:number;
    bounces:number;
    iterations:number = 1;

    constructor() {
        var self = this;

        addEventListener('message', (e:any) => {

            if (self.command == null) {
                self.command = e.data;

                if (self.command === TraceWorker.TERMINATE) {
                    self.paused = true;
                    self.command = null;
                }

            } else if (self.command == TraceWorker.INIT) {

                TraceWorker.id = e.data.id;

                //console.time("WOKER_INIT:" + TraceWorker.id);
                self.command = null;
                self.pixelMemory = new Uint8ClampedArray(e.data.pixelBuffer);
                self.sampleMemory = new Float32Array(e.data.sampleBuffer);
                self.sceneMemory = new DirectMemory(e.data.sceneBuffer);

                if (!self.camera) {
                    self.camera = Camera.fromJson(e.data.camera);
                }
                if (!self.scene) {
                    self.flags = new Uint8Array(self.sceneMemory.data.buffer, 0, 3);
                    self.scene = SharedScene.getScene(self.sceneMemory);
                    /*self.scene.compile();*/
                }
                //this.scene.add(Sphere.newSphere(new Vector3(-1, 4, -1), 0.5, new LightMaterial(new Color(1, 1, 1), 3, new LinearAttenuation(1))));
                //self.scene.rays = 0;

                self.full_width = e.data.full_width;
                self.full_height = e.data.full_height;
                self.cameraSamples = e.data.cameraSamples;
                self.hitSamples = e.data.hitSamples;
                self.bounces = e.data.bounces;

                /*self.init(
                 e.data.width,
                 e.data.height,
                 e.data.xoffset,
                 e.data.yoffset
                 );*/

                //console.timeEnd("WOKER_INIT:" + TraceWorker.id);
                postMessage(TraceWorker.INITED);

            } else if (self.command == TraceWorker.TRACE) {
                //console.log("TRACE");
                self.command = null;
                self.paused = false;
                self.init(
                    e.data.width,
                    e.data.height,
                    e.data.xoffset,
                    e.data.yoffset
                );

                self.cameraSamples = e.data.cameraSamples || self.cameraSamples;
                self.hitSamples = e.data.hitSamples || self.hitSamples;

                if (e.data.camera) {
                    self.camera.updateFromJson(e.data.camera);
                    //console.log("init_iterations:" + e.data.init_iterations);
                    //self.clearSamples();
                }

                //should not change bounce
                //self.bounces = e.data.bounces || self.bounces;

                self.iterations = e.data.init_iterations;
                if (self.iterations > 0 && e.data.blockIterations) {
                    for (var i = 0; i < e.data.blockIterations; i++) {
                        self.run();
                    }
                } else {
                    self.run();
                }
                if (this.paused) {
                    return;
                }
                if (this.flags[0] === 1) {//pixels are locked
                    return;
                }
                postMessage(TraceWorker.TRACED);
            }
        }, false);
    }

    init(width:number, height:number, xoffset:number, yoffset:number):void {
        this.width = width;
        this.height = height;
        this.xoffset = xoffset;
        this.yoffset = yoffset;
        this.iterations = 1;
        this.samples = [];
        this.absCameraSamples = Math.round(Math.abs(this.cameraSamples));
    }

    run():void {
        /*if (this.paused) {
         return;
         }*/
        if (this.flags[0] === 1) {//pixels are locked
            console.log("pixels are locked");
            return;
        }
        this.iterations++;
        var hitSamples = this.hitSamples;
        var cameraSamples = this.cameraSamples;
        var absCameraSamples = this.absCameraSamples;
        if (this.iterations == 1) {
            hitSamples = 1;
            cameraSamples = -1;
            absCameraSamples = Math.round(Math.abs(cameraSamples));
        }

        //console.time("render");
        for (var y:number = this.yoffset; y < this.yoffset + this.height; y++) {

            for (var x:number = this.xoffset; x < this.xoffset + this.width; x++) {

                if (this.paused) {
                    return;
                }
                if (this.flags[0] === 1) {//pixels are locked
                    return;
                }

                var screen_index:number = (y * (this.full_width * 3)) + (x * 3);
                var _x:number = x - this.xoffset;
                var _y:number = y - this.yoffset;

                var c:Color = new Color();

                if (cameraSamples <= 0) {
                    // random subsampling
                    for (let i = 0; i < absCameraSamples; i++) {

                        if (this.paused) {
                            return;
                        }
                        if (this.flags[0] === 1) {//pixels are locked
                            return;
                        }

                        var fu = Math.random();
                        var fv = Math.random();
                        var ray = this.camera.castRay(x, y, this.full_width, this.full_height, fu, fv);
                        c = c.add(this.scene.sample(ray, true, hitSamples, this.bounces))
                    }
                    c = c.divScalar(absCameraSamples);
                } else {
                    // stratified subsampling
                    var n:number = Math.round(Math.sqrt(cameraSamples));
                    for (var u = 0; u < n; u++) {
                        for (var v = 0; v < n; v++) {

                            if (this.paused) {
                                return;
                            }
                            if (this.flags[0] === 1) {//pixels are locked
                                return;
                            }

                            var fu = (u + 0.5) / n;
                            var fv = (v + 0.5) / n;
                            var ray:Ray = this.camera.castRay(x, y, this.full_width, this.full_height, fu, fv);
                            c = c.add(this.scene.sample(ray, true, hitSamples, this.bounces));
                        }
                    }
                    c = c.divScalar(n * n);
                }
                c = c.pow(1 / 2.2);

                this.updatePixel(c, screen_index);

                if (Renderer.DEBUG && x == this.xoffset || Renderer.DEBUG && y == this.yoffset) {
                    this.drawPixelInt(screen_index, 0xFFFF00F);
                }
            }
        }
        //console.timeEnd("render");
    }

    updatePixel(color:Color, si:number):void {

        if (this.paused) {
            return;
        }
        if (this.flags[0] === 1) {//pixels are locked
            return;
        }
        this.sampleMemory[si] += color.r;
        this.sampleMemory[si + 1] += color.g;
        this.sampleMemory[si + 2] += color.b;

        this.pixelMemory[si] = Math.max(0, Math.min(255, (this.sampleMemory[si] / this.iterations) * 255));
        this.pixelMemory[si + 1] = Math.max(0, Math.min(255, (this.sampleMemory[si + 1] / this.iterations) * 255));
        this.pixelMemory[si + 2] = Math.max(0, Math.min(255, (this.sampleMemory[si + 2] / this.iterations) * 255));

    }

    clearSamples() {
        for (var y:number = this.yoffset; y < this.yoffset + this.height; y++) {
            for (var x:number = this.xoffset; x < this.xoffset + this.width; x++) {
                var si:number = (y * (this.full_width * 3)) + (x * 3);
                this.sampleMemory[si] = 0;
                this.sampleMemory[si + 1] = 0;
                this.sampleMemory[si + 2] = 0;
            }
        }
    }

    drawColor(i:number, rgba:RGBA):void {

        this.pixelMemory[i] = rgba.r;
        this.pixelMemory[i + 1] = rgba.g;
        this.pixelMemory[i + 2] = rgba.b;

    }

    drawPixelInt(i:number, color:number) {

        var red = (color >> 16) & 255;
        var green = (color >> 8) & 255;
        var blue = color & 255;

        this.pixelMemory[i] = red;
        this.pixelMemory[i + 1] = green;
        this.pixelMemory[i + 2] = blue;
    }
}
new TraceWorker();