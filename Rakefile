require 'fileutils'
DEPLOY_DIR = "deploy"

def find_rakefile_dir
  __FILE__.to_s.split(/Rakefile/i)[0]
end

def make_output_filename(name)
  DEPLOY_DIR+"/"+name.sub(/\.template\.html$/, 'App.html')
end


def assure_deploy_directory_exists
  mkdir DEPLOY_DIR unless  File.exists?(DEPLOY_DIR)
end

def write_out_file(filename, new_html, concatenated_css, concatenated_js)
  puts "\n\tCreating merged app html file #{filename}..."
  File.open(filename, "w") do |file|
    style_tag = "    <style type=\"text/css\">\n#{concatenated_css}\n    </style>\n"
    script_tag = "    <script type=\"text/javascript\">\n#{concatenated_js}\n    </script>"
    content = new_html.sub("<!-- insert concatenated CSS here -->", style_tag)
    content = content.sub("<!-- insert concatenated JS here -->", script_tag)
    file.write(content)
    puts "\t#{filename} successfully created!\n\n"
  end
end

desc "Parses mashup HTML and replaces stylesheet includes with the referenced CSS content and JS includes with the JS itself to create Rally-ready HTML"
task :combine do |t, args|
  find_rakefile_dir
  first_css = true
  first_js = true
  Dir.chdir(Rake.original_dir)
  SRC = FileList['*.template.html']
  SRC.each do |mashup_file|
    new_html = ""
    puts("\nProcessing #{mashup_file}...")
    script_names = []
    stylesheet_names = []
    IO.foreach(mashup_file) do |line|
      # If the line refers to script content contained in a local file, save the name of the file for later
      if    !(line =~ /<script.*src="https*:/) \
 && !(line =~ /<script.*src="\/slm/)   \
 && !(line =~ /\/sdk.js/) \
 && line =~ /<script.*src="(.*)"/
        script_file = $1
        script_names << script_file
        if first_js
          new_html << "\n<!-- insert concatenated JS here -->\n"
          first_js = false
        end
        # or if the line pulls in a CSS stylesheet from a local file, save the name of the file for later
      elsif    (line !~ /<link .*href="https?:\/\//) \
 && (line !~ /<link.*href="\/slm/)   \
 && (line =~ /<link rel="stylesheet" .*href="(.*\.css)"/)
        stylesheet_names << $1
        if first_css
          new_html << "\n<!-- insert concatenated CSS here -->\n"
          first_css = false
        end
      else
        new_html << line
      end
    end

    concatenated_css = ""
    stylesheet_names.each do |stylesheet_name|
      puts "\tConcatenating #{stylesheet_name}..."
      lines = IO.readlines(stylesheet_name)
      lines.each do |l|
        concatenated_css << '    ' << l.to_s.gsub(/\n/, "\n    ")
      end
      concatenated_css << "\n"
    end

    concatenated_js = ""
    script_names.each do |script_name|
      lines = IO.readlines(script_name)
      first_js = lines.first
      puts "\tConcatenating #{script_name}..."
      lines.each do |l|
        concatenated_js << '    ' << l.to_s.gsub(/\n/, "\n    ")
      end
      concatenated_js << "\n"

    end

    output_filename = make_output_filename(mashup_file)
    write_out_file(output_filename, new_html, concatenated_css, concatenated_js)

  end
end

desc "Runs JSLint on all component JavaScript files"
task :jslint do
  Dir.chdir(Rake.original_dir)
  puts "\nRunning jslint..."
  script_names = []
  TEMPLATES = FileList['*.template.html']
  TEMPLATES.each do |mashup_file|
    IO.foreach(mashup_file) do |line|
      if    !(line =~ /<script.*src="https*:/) \
 && !(line =~ /<script.*src="\/slm/)   \
 && !(line =~ /\/sdk.js/) \
 && line =~ /<script.*src="(.*)"/
        script_names << $1
      end
    end
  end

  #Run jslint
  script_names.each do |script_name|
    puts
    puts "\t-------JSLint output for #{script_name}--------------"
    puts `~/projects/alm/src/bin/jslint --options browser,cap,debug,devel,evil,fragment,laxbreak,on -f "./#{script_name}"`
  end
end

desc "Combine and run jslint"
task :deploy do |t, args|
  assure_deploy_directory_exists
  Rake::Task[:jslint].invoke()
  Rake::Task[:combine].invoke()
end

desc "Default task"
task :default do |t, args|
  Rake::Task[:deploy].invoke()
end

def writeFile(path, content)
  puts "Creating file #{path}..."
  File.open(path, "w") do |file|
    file.write(content)
  end
end

desc "Create a new app"
task :new, :appName do |t, args|
  puts args.appName
  if (!File.directory? "./#{args.appName}")
    puts "Creating directory #{args.appName}..."
    mkdir "./#{args.appName}"
    writeFile("./#{args.appName}/#{args.appName}.css", "")
    writeFile("./#{args.appName}/#{args.appName}.js", "function #{args.appName}() {
  var that = this;
  this.display = function(element) {
  };
}")
    writeFile("./#{args.appName}/#{args.appName}.template.html",
              "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">
<!-- Copyright (c) #{Time.new.year}  Rally Software Development Corp.  All rights reserved -->
<html>
<head>
    <title>#{args.appName}</title>
    <meta name=\"Name\" content=\"App: #{args.appName}\"/>
    <meta name=\"Version\" content=\"#{Time.new.strftime("%Y.%m.%d")}\"/>
    <meta name=\"Vendor\" content=\"Rally Software\"/>
    <script type=\"text/javascript\" src=\"/apps/1.29/sdk.js?debug=true\"></script>
    <script type=\"text/javascript\" src=\"#{args.appName}.js\"></script>
    <link rel=\"stylesheet\" href=\"#{args.appName}.css\" type=\"text/css\">
    <script type=\"text/javascript\">

        function onLoad() {
            var #{args.appName[0, 1].downcase << args.appName[1, args.appName.length-1]} = new #{args.appName}();
            #{args.appName[0, 1].downcase << args.appName[1, args.appName.length-1]}.display(dojo.body());
        }

        rally.addOnLoad(onLoad);

    </script>
</head>
<body>
</body>
</html>")
  else
    puts "Directory #{args.appName} already exists!"
  end
end

desc "Build all apps and copy the built output to lam"
task :deployall do |t, args|
  apps = Dir['*/']
  apps.each do |app_dir|
    puts "Building #{app_dir.chomp('/')}..."
    # Dir.chdir(app_dir)
    puts `rake`
    # Dir.chdir("..")
  end
end