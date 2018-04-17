# vannot
Video Annotation Tool

Web-based tool for labeling and annotation of video frames. The tool allows for the definition of one or more labels and vector or raster based annotation of single video frames. The tool relies on image processing techniques such as grab-cut to assist in obtaining the initial annotation which can then be further refined using manual editing tools. Fully annotated frames can be downloaded or persisted server-side. Capabilities can be accessed via external applications as a Javascript library.

## build

You can build natively or via Docker.

**For native build**, navigate to `project/` and run `make`. If you encounter trouble, manually running `npm install` should resolve most issues. The built files can be found in `build/` in the project root, or in `project/lib/`.

**For Docker build**, you'll need to first build the builder container. Navigate to `project/` and run: `docker build -t vannot-build .`. In the rare cases that the project dependencies change, you'll have to do this again to rebuild the container, as the npm packages are cached for speed. Then, do actually perform a build, navigate to the project root directory, and run: `docker run --volume=$(pwd)/project/src:/usr/vannot/project/src --volume=$(pwd)/build:/usr/vannot/build vannot-build`. This mounts your source tree and the `build/` directory from the local project root into the image and runs the build against them.

## integrate

Vannot provides a simple read/write API for data loading and extraction. It uses a single JSON data structure to communicate everything (video information, annotated objects and shapes, etc) in either direction. At load time, a querystring parameter of `?data=VALUE` tells Vannot how to **read** everything it needs to know, including where to then **write** the data when the user clicks Save.

### loading data

As mentioned above, a querystring parameter with a key of `data` is expected. It can have one of two values:

* **A URL** will tell Vannot to issue a `GET` request to that URL; it will expect the response to that request to be a data structure of the format shown below. Cross-domain requests are possible if the the URL is absolute (ie if it begins with `https://` rather than a relative `/`), but keep [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) restrictions and requirements in mind when doing so.
* `local` is a shortcut to ease development: instead of calling server/http endpoints to save/load data, it simply reads and writes data to and from `localStorage`. _This is primarily meant for development use_, so that a server does not have to be written or run just to work on the Vannot UI.

### vannot data structure

First, let's look at an example data instance. This is the minimum data one must provide to Vannot to initialize it against a fresh video:

```javascript
{
  "video": { "fps": 25, "duration": 125100, "width": 1920, "height": 1080, "source": "/path/to/video.mp4" },
  "saveUrl": "/save"
}
```

As you can see, the video itself is described, and a `saveUrl` is provided: this is the path that Vannot will attempt to `POST` the updated data to. Here is a slightly more complex example:

```javascript
{
  video: { fps: 25, duration: 125100, width: 1920, height: 1080, source: "/path/to/video.mp4" },
  frames: [
    { frame: 45157, shapes: [
      { id: 0, objectId: 1, points: [
        { x: 842.1428571428571, y: 662.1428571428571 }, 
        { x: 893.5714285714286, y: 677.1428571428573 },
        { x: 939.6428571428571, y: 678.2142857142858 },
        { x: 929.4642857142857, y: 615.5357142857143 },
        { x: 915, y: 527.1428571428571 },
        { x: 904.2857142857142, y: 597.8571428571429 }
      ] }
    ] }
  ],
  objects: [
    { id: -1, title: "Unassigned", color: "#aaa", system: true },
    { id: 1, title: "Sailboat", color: "#07e4ff" }
  ],
  saveUrl: "/save"
}
```

(Key-string quotation-marks have been omitted for brevity.) Here you can see some frame and object annotations; each frame can have multiple shapes, each shape references and object and has multiple points. Objects are defined separately.

Now that we have some tactile sense of what's going on, here is a full specification of what the entire data structure:

* `video: Object`: Defines basic properties about the video itself. Never modified by Vannot.
  * `fps: Number`: The framerate of the video.
  * `duration: Integer`: The duration of the video, in frames.
  * `width: Integer`: The width of the video, in pixels.
  * `height: Integer`: The height of the video, in pixels.
  * `source: String[URL]`: The absolute or relative path to the video itself.
* `frames: Array`: Each frame that has any shapes drawn on it will have an entry in this array.
  * `frame: Integer`: The frame-timecode of the frame in question.
  * `shapes: Array`: Each individual shape, regardless of object assignment, has an entry here.
    * `id: Integer`: _Internal_. Do not modify or omit.
    * `objectId: Integer`: References the `id` of the classification `object` this shape is attached to.
    * `points: Array`: The points of the shape. The final point closes implicitly to the first point.
      * `x: Number`: The x-coördinate of this point, in pixels.
      * `y: Number`: The y-coördinate of this point, in pixels.
* `objects: Array`: Each classification object is represented here. In addition, there is **always** a system-managed object with an `id` of `-1` and a `title` of `Unassigned`. _Do not modify it_; it also has a `system` property of `true` to help identify it.
  * `id: Integer`: The id of this object. It is meaningless other than as a reference to join shapes by.
  * `title: String`: The user-assigned title of this classification object.
  * `color: String[HexColor]`: _Internal_. A `#`-prepended hex color string. Meaningful only in the editor.
  * `system: Boolean`: Only true for the `Unassigned` system object (see the note on the `objects` array above). If true, do not modify or omit the data.
* `imageData: Object`: **Provided only on save**; this k/v bag may contain base64-encoded captures of annotated video frames. See **image data export** below. It is _highly recommended_ not to store and send this data back to the Vannot client for session resumption; it is likely very large and useless to Vannot.
  * Each key in this bag is the frame-timecode, and each value is a [Data URI](https://tools.ietf.org/html/rfc2397) of an image capture of that frame. It is minorly lossy due to JPEG recompression.
* `saveUrl: String[URL]`: The path that an updated version of this data structure will be `POST`ed back to when the user clicks on Save.

### image data export

Due to concern around deterministically isolating the same frame across different toolchains, Vannot captures image data of annotated frames and sends them to the server for safekeeping.

By default, it will only do this for any frames _newly annotated in that session_. Any frames that already had drawn shapes when Vannot loaded the data initially will not be included.

To initiate an export of all framedata, add a querystring parameter of `mode=export`. This will not load the full editor UI, but instead initiate a process wherein every single annotated frame is captured and exported back to the server, via the normal save process.

### serving the application

Once built, all one must do is serve the following files off a web server:

```
index.html
app.js
styles.css
assets/*
```

The only other requirement is that for direct seeking around the video to work, the web server must support byterange requests. Most modern versions of Nginx/Apache/Lighttpd will do this out of the box or with minor configuration, but eg Python's `SimpleHTTPServer` will not.

