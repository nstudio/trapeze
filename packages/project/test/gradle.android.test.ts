import { CapacitorConfig } from "@capacitor/cli";
import { CapacitorProject } from '../src';
import { Gradle, GradleASTNode, GradleAST } from '../src/android/gradle';

import { join } from 'path';
import { VFS } from "../src/vfs";

describe('project - android - gradle', () => {
  let config: CapacitorConfig;
  let project: CapacitorProject;
  let vfs: VFS;
  beforeEach(async () => {
    config = {
      ios: {
        path: '../common/test/fixtures/ios'
      },
      android: {
        path: '../common/test/fixtures/android'
      }
    }

    project = new CapacitorProject(config);
    await project.load();
    vfs = new VFS();
  });

  it('Should find path to gradle parse', async () => {
    const gradle = new Gradle(join(project.config.android!.path!, 'build.gradle'), vfs);
    expect(gradle.getGradleParserPath()).not.toBeUndefined();

    const output = await gradle.parse();
    expect(output).not.toBeNull();
  });

  it.skip('Should throw an exception if no JAVA_HOME set', async () => {
    process.env.JAVA_HOME = '';
    const gradle = new Gradle(join(project.config.android!.path!, 'build.gradle'), vfs);
    await expect(gradle.parse()).rejects.toThrow();
  });

  it.only('Should find target element in parsed Gradle', async () => {
    const gradle = new Gradle(join(project.config.android!.path!, 'build.gradle'), vfs);
    await gradle.parse();

    let nodes = gradle.find({
      buildscript: {
        dependencies: {}
      }
    });

    expect(nodes.length).not.toBe(0);
    expect(nodes[0].type).toBe('method');
    expect(nodes[0].name).toBe('dependencies');

    // Should find the root node
    nodes = gradle.find({});

    expect(nodes.length).not.toBe(0);
  });

  it('Should inject at spot', async () => {
    const gradle = new Gradle(join(project.config.android!.path!, 'app', 'build.gradle'), vfs);

    await gradle.injectProperties({
      dependencies: {}
    }, [
      { implementation: "'com.super.cool'" },
      { implementation: "'com.super.amazing'" },
    ]);
  });

  it('Should inject at root', async () => {
    const gradle = new Gradle(join(project.config.android!.path!, 'app', 'build.gradle'), vfs);

    await gradle.injectProperties({}, [
      { 'apply from:': "'my.cool.package'" }
    ]);
  });

  it('Should inject nested Gradle statements', async () => {
    const gradle = new Gradle(join(project.config.android!.path!, 'build.gradle'), vfs);

    await gradle.injectProperties({
      dependencies: {}
    }, [
      { classpath: "'com.super.cool'" },
      { classpath: "'com.super.amazing'" },
    ]);

    await gradle.injectProperties({
      allprojects: {
        repositories: {}
      }
    }, [{
      maven: [{
        url: "'https://pkgs.dev.azure.com/MicrosoftDeviceSDK/DuoSDK-Public/_packaging/Duo-SDK-Feed/maven/v1'",
        name: "'Duo-SDK-Feed'"
      }]
    }]);
  });

  it.only('Should inject Gradle statements in empty method blocks', async () => {
    const gradle = new Gradle(join('../common/test/fixtures/inject.gradle'), vfs);

    await gradle.injectProperties({
      dependencies: {}
    }, [
      { implementation: "'com.whatever.cool'" }
    ]);

    let source = vfs.get(gradle.filename).getData();
    expect(source).toBe(`
dependencies {
    implementation 'com.whatever.cool'
}

buildscript {
    thing {
    }
    dependencies {
        implementation 'fake thing'
    }
}

allprojects {
    nest1 {
        nest2 {
            dependencies {}
        }
    }
}
`.trim());


    await gradle.injectProperties({
      buildscript: {
        dependencies: {}
      }
    }, [
      { classpath: "files('path/to/thing')" }
    ]);

    source = vfs.get(gradle.filename).getData();

    expect(source).toBe(`
dependencies {
    implementation 'com.whatever.cool'
}

buildscript {
    thing {
    }
    dependencies {
        implementation 'fake thing'
        classpath files('path/to/thing')
    }
}

allprojects {
    nest1 {
        nest2 {
            dependencies {}
        }
    }
}
`.trim());

    await gradle.injectProperties({
      allprojects: {
        nest1: {
          nest2: {
            dependencies: {}
          }
        }
      }
    }, [
      { thing: "'here'" }
    ]);

    source = vfs.get(gradle.filename).getData();
    expect(source).toBe(`
dependencies {
    implementation 'com.whatever.cool'
}

buildscript {
    thing {
    }
    dependencies {
        implementation 'fake thing'
        classpath files('path/to/thing')
    }
}

allprojects {
    nest1 {
        nest2 {
            dependencies {
                thing: 'here'
            }
        }
    }
}
`.trim());
  });
});