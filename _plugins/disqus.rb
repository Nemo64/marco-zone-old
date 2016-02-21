module Jekyll

  class DiscussPage < Page
    def initialize(site, base, post)
      @site = site
      @base = base
      @dir = File.dirname(File.join('disqus', post.url))
      @name = File.basename(post.destination('/'))

      self.process(@name)
      self.read_yaml(File.join(base, '_special'), 'disqus.html')
      self.data['related_page'] = post

      self.data['title'] = post.title
    end
  end

  class DiscussPageGenerator < Generator
    safe true

    def generate(site)
      site.posts.each do |post|
        if post.data['amp']
          site.pages << DiscussPage.new(site, site.source, post)
        end
      end
    end
  end

end