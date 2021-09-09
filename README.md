# vannot
Video Annotation Tool

Web-based tool for labeling and annotation of video frames. The tool allows for the definition of one or more labels and vector or raster based annotation of single video frames. The tool relies on image processing techniques such as grab-cut to assist in obtaining the initial annotation which can then be further refined using manual editing tools. Fully annotated frames can be downloaded or persisted server-side. Capabilities can be accessed via external applications as a Javascript library.

## Requirements

- Download and install the latest version of [Git](https://git-scm.com/downloads/).
- Download and install the latest (not the LTS) version of [NodeJS](https://nodejs.org/en/download/current/).
- Run `npm -g i npm` to get yourself the latest version of the npm package manager.

To check the tools have been set up properly, check that you can run `git version`, `node -v` and `npm -v` from a command terminal.

Execute the following commands in the (new, empty) directory where you want to set up the project:

- Checkout the code: `git clone git@github.com:xyonix/vannot.git .`
- Install project dependencies: `npm install`

## Building and running

There are multiple ways to work with this repository:

- You can run `npm run build` to build a minified production-ready version of the application.
- You can run `npm run serve` to start a development environment on [localhost:8080](http://localhost:8080) that will automatically rebuild changes.

Alternatively you can serve the application using docker. An example `Docker-compose.yml` file is given as `Docker-compose.yml.dist`. 
- Using Docker-compose.yml run `docker-compose up -d` to start a production ready version of the application.

## Directory layout

- `/data/` contains the data files used by the application.
- `/src/` contains the main application source code.
- `/dist/` contains builds of the application

## use

There are a lot of tooltips in the application to help learn its usage. Generally, you use the timeline below to navigate the video, and then the Draw button on the main toolbar to create new shapes. Closing the shape will complete it. Shapes may be grouped into Instance Groups, but only when they are wholly selected. Instance Groups just indicate that multiple shapes are somehow a single entity; each group may then be assigned particular classes, to indicate what _kind_ of entity it is.

The keyboard and mouse shortcuts are as follows:

* Zoom in/out: **scrollwheel**
* Reset zoom and center canvas: **double-tap spacebar**
* Quick-toggle to pan tool: **hold spacebar** (letting go of spacebar returns to selection tool)
* Copy Last: **Ctrl+D** (Windows) / **Cmd+D** (Mac)

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
  * `start: Integer = 0`: _(optional)_ The start of the video segment you wish to expose, in frames. Defaults to `0`.
  * `duration: Integer`: The duration of the video segment you wish to expose, in frames.
  * `width: Integer`: The width of the video, in _square_ pixels. (See anamorphic note below.)
  * `height: Integer`: The height of the video, in _square_ pixels.
  * `source: String[URL]`: The absolute or relative path to the video itself.
  * `pixelAspectRatio: Float`: _(optional)_ The PAR/SAR of the video. Only provide this if the video pixels are nonsquare (see anamorphic note below).
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
* `instances: Array`: Each individual identified instance is tracked here.
  * `id: Integer`: The id of the instance. It is meaningless other than as a reference to join shapes by.
  * `class: String`: The instance class this instance belongs to. Can be any string value.
* `instanceClasses: Array`: _(optional)_ Each instance class preset is defined here. Ad-hoc (freeform) instance classes are not represented here.
  * `id: String`: The id of this instance class. The interface will present this id as the selection/autocomplete option.
  * `color: String[Color]`: A valid CSS color designation of any kind, to be applied to the outline of instances of this class.
* `labels: Array`: The time-segment labelling information is saved here.
  * `title: String`: The user-assigned title of this annotation label.
  * `color: String[HexColor]`: _Internal_. A `#`-prepended hex color string. Meaningful only in the editor.
  * `segments: Array`: The time-segments of the video to which this label applies. They are stored in no particular order.
    * `start: Integer`: The start of the segment, in frames.
    * `end: Integer`: The start of the segment, in frames.
* `app: Object`: _(optional)_ Customization options for the browser application.
  * `title: String`: _(optional)_ Sets the window/tab title.
  * `favicon: String[URL]`: _(optional)_ Sets the favicon source URL.
  * `instance: Object`: _(optional)_ Customization options for instance grouping
    * `classMode: String = (freeform|preset|none)`: Sets the instance class mode:
      * `freeform`: A combobox is given to set the instance class. Will suggest autocomplete from the corpus of extant instanceClasses, both user-generated and predefined in the data (see `instanceClasses` above).
      * `preset`: A dropdown is given to set the instance class. Only the options preset in `instanceClasses` are available.
      * `none`: Instance class selection is entirely disabled. Instance grouping is still available.
* `saveUrl: String[URL]`: The path that an updated version of this data structure will be `POST`ed back to when the user clicks on Save. Please see the following section for details about this save request.

Any data specified outside these reserved keys will be preserved by Vannot through save/load cycles without modification. However, as more features added and more keys will be used, we recommend the use of the `custom`, `user`, and `meta` top-level keys, which we will always reserve and avoid for this purpose.

### anamorphic video formats

Be careful when specifying a video resolution. The browser does not give Vannot enough data to determine any information about the resolution itself, which is why you are required to specify it at all, and an incorrect resolution will result in misalignment when comparing annotation data with static video frames.

In particular, some videos are recorded with non-square pixels, in an anamorphic format. The relevant specification detail is the PAR, or Pixel Aspect Ratio. When a video is encoded with a non-1:1 PAR, a naive check of the resolution will yield the incorrect number, because the physical number of recorded rows and columns does not match the presentation number of rows and columns.

Ultimately, no matter how the video is encoded, it is the equivalent resolution in _square pixels_ that you need to provide. However many pixels the video actually takes up on screen when played, that is the number of interest.

If you are unable to perform this calculation yourself, you may extract the PAR from the video and provide it to Vannot under the `video.pixelAspectRatio` parameter as a float. It will attempt to recompute the resolution for you.

Vannot draws a grey bounding box around the area it believes to be the canvas. If this box mismatches with the actual video area, it is a sign that the incorrect effective resolution has been provided. In this case, it is highly advisable to resolve these issues before attempting to perform any annotation.

### saving data/image data export

Due to concern around deterministically isolating the same frame across different toolchains, Vannot captures image data of annotated frames and sends them to the server for safekeeping. Because of this additional data, Vannot sends save requests as a `multipart/form-data` `POST`. There can be multiple fields/files:

* The `data.json` field will always exist and should always be sent first. It contains the actual application data. In addition to providing the various point geometries for the server's analysis, this payload is what the client will want returned to resume a working session.
* Any number of `frames/42` files will also be a part of the `POST`. The number following the slash indicates the number of the frame in question, and the binary content of each part is the image data of that frame in jpeg format.

By default, it will only export image data for any frames _newly annotated in that session_. Any frames that already had drawn shapes when Vannot loaded the data initially will not be included.

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

