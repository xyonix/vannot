# vannot
Video Annotation Tool

Web-based tool for labeling and annotation of video frames. The tool allows for the definition of one or more labels and vector or raster based annotation of single video frames. The tool relies on image processing techniques such as grab-cut to assist in obtaining the initial annotation which can then be further refined using manual editing tools. Fully annotated frames can be downloaded or persisted server-side. Capabilities can be accessed via external applications as a Javascript library.

## build

You can build natively or via Docker.

**For native build**, navigate to `project/` and run `make`. If you encounter trouble, manually running `npm install` should resolve most issues. The built files can be found in `build/` in the project root, or in `project/lib/`.

**For Docker build**, you'll need to first build the builder container. Navigate to `project/` and run: `docker build -t vannot-build .`. In the rare cases that the project dependencies change, you'll have to do this again to rebuild the container, as the npm packages are cached for speed. Then, do actually perform a build, navigate to the project root directory, and run: `docker run --volume=$(pwd)/project/src:/usr/vannot/project/src --volume=$(pwd)/build:/usr/vannot/build vannot-build`. This mounts your source tree and the `build/` directory from the local project root into the image and runs the build against them.

